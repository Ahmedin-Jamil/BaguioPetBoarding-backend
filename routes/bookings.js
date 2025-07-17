/**
 * Bookings Routes
 * Handles all routes related to bookings
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

const emailService = require('../services/emailService');
const bookingController = require('../controllers/bookingController'); // Flattened schema controller

// Flattened schema booking creation route (declared early to override legacy implementation)
// Flattened schema booking creation route
router.post('/', (req, res, next) => {
  console.log('ROUTE: Received POST /api/bookings request');
  console.log('ROUTE: Request body:', req.body);
  return bookingController.createBooking(req, res, next);
});

// Add middleware to ensure consistent service type handling for all routes
// This will be applied to all bookings routes
router.use((req, res, next) => {
  // Store the original json method to enhance it
  const originalJson = res.json;
  
  // Override the json method to enhance booking data
  res.json = function(data) {
    // Check if this is a booking response with data
    // If response is wrapped like { data: ... }
    if (data && data.data !== undefined) {
      enhanceBookingData(data.data);
    } else {
      // data itself may be a booking object, an array of bookings, or something else
      enhanceBookingData(data);
    }
    // Helper to enhance booking(s)
    function enhanceBookingData(payload) {
      if (!payload) return;

      // If array
      if (Array.isArray(payload)) {
        payload.forEach(enhanceSingleBooking);
      } else if (typeof payload === 'object') {
        enhanceSingleBooking(payload);
      }
    }

    function enhanceSingleBooking(booking) {
      if (!booking || typeof booking !== 'object') return;
      // Map serviceId
      if (booking.service_id && !booking.serviceId) {
        booking.serviceId = booking.service_id;
      }
      // Derive is_daycare using service_id, serviceId, or service_type
      if ((booking.service_id === 4 || booking.serviceId === 4 || booking.service_type === 'daycare') && booking.is_daycare !== 1) {
        booking.is_daycare = 1;
      }
      // Derive serviceType
      if (booking.is_daycare === 1 || booking.is_daycare === true || booking.service_id === 4 || booking.serviceId === 4 || booking.service_type === 'daycare') {
        booking.serviceType = 'daycare';
      } else if (booking.service_type && !booking.serviceType) {
        booking.serviceType = booking.service_type;
      } else if (!booking.serviceType) {
        booking.serviceType = 'overnight';
      }
    }

    // Call the original json method
    return originalJson.call(this, data);
  };
  
  next();
});

// Validation and normalization functions
const validateBookingData = (booking) => {
    const errors = [];

    // Validate pet information
    if (booking.guest_pet) {
        if (!booking.guest_pet.pet_type) {
            errors.push('Pet type is required');
        }
    }

    // Validate guest information for guest bookings
    if (booking.guest_booking_only && booking.guest_user) {
        if (!booking.guest_user.email) {
            errors.push('Guest email is required');
        }
        if (!booking.guest_user.phone) {
            errors.push('Guest phone is required');
        }
    }

    // Validate dates and times
    if (!booking.booking_date || !booking.end_date) {
        errors.push('Both start and end dates are required');
    }

    // Validate time format
    const timeRegex = /^(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?|\d{2}:\d{2})$/;
    if (!booking.start_time || !timeRegex.test(booking.start_time)) {
        errors.push('Invalid start time format. Use either 24-hour (HH:mm) or 12-hour (HH:mm AM/PM) format');
    }
    if (!booking.end_time || !timeRegex.test(booking.end_time)) {
        errors.push('Invalid end time format. Use either 24-hour (HH:mm) or 12-hour (HH:mm AM/PM) format');
    }

    return errors;
};

// Function to convert various time formats to 24-hour format
const to24HourFormat = (timeStr) => {
    if (!timeStr) return null;
    
    // If it's already in 24-hour format (HH:mm or HH:mm:ss)
    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(timeStr)) {
        // Ensure it has seconds
        if (timeStr.split(':').length === 2) {
            return `${timeStr}:00`;
        }
        return timeStr;
    }
    
    // Handle 12-hour format with AM/PM
    const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?(\s*[AP]M)$/i);
    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? match[2] : '00';
        const isPM = match[3].trim().toUpperCase() === 'PM';
        
        if (isPM && hours < 12) {
            hours += 12;
        } else if (!isPM && hours === 12) {
            hours = 0;
        }
        
        return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
    }
    
    // If format is not recognized, return a default time
    console.log(`Warning: Unrecognized time format '${timeStr}', using default time`);
    return '12:00:00';
};


const normalizeBookingData = (booking) => {
    // Normalize pet data
    const pet = {
        name: booking.guest_pet?.pet_name || '',
        type: booking.guest_pet?.pet_type || booking.pet_type || '',
        breed: booking.guest_pet?.breed || '',
        gender: booking.guest_pet?.gender || ''
    };

    // Normalize guest data
    const guest = booking.guest_booking_only ? {
        first_name: booking.guest_user?.first_name || '',
        last_name: booking.guest_user?.last_name || '',
        email: booking.guest_user?.email || '',
        phone: booking.guest_user?.phone || '',
        address: booking.guest_user?.address || ''
    } : null;

    // Normalize room type
    const roomType = normalizeRoomType(booking.room_type);

    return {
        guest_booking_only: booking.guest_booking_only,
        pet_type: pet.type,
        booking_date: booking.booking_date,
        end_date: booking.end_date,
        start_time: to24HourFormat(booking.start_time),
        end_time: to24HourFormat(booking.end_time),
        special_requests: booking.special_requests || '',
        room_type: roomType,
        guest_user: guest,
        guest_pet: {
            ...pet,
            pet_name: pet.name,
            pet_type: pet.type,
            pet_breed: pet.breed
        }
    };
};

// Utility functions for data validation and normalization
function normalizeRoomType(roomType) {
  if (!roomType) return null;
  const val = roomType.toString().trim().toLowerCase().replace(/_/g, ' ');
  if (val === 'deluxe' || val === 'deluxe room') return 'Deluxe Room';
  if (val === 'premium' || val === 'premium room') return 'Premium Room';
  if (val === 'executive' || val === 'executive room') return 'Executive Room';
  // Accept partials for robustness
  if (val.includes('deluxe')) return 'Deluxe Room';
  if (val.includes('premium')) return 'Premium Room';
  if (val.includes('executive')) return 'Executive Room';
  return null;
}

// --- UTC ISO 8601 Date Utilities ---
/**
 * Extracts 'YYYY-MM-DD' from an ISO 8601 string or returns the input if already in that format
 * @param {string} isoString
 * @returns {string|null}
 */
function formatDate(isoString) {
  if (!isoString) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return isoString;
  if (/^\d{4}-\d{2}-\d{2}T/.test(isoString)) return isoString.slice(0, 10);
  return null;
}

/**
 * Validates if a string is a UTC ISO 8601 string (YYYY-MM-DDTHH:MM:SS.sssZ)
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidUTCDateString(dateStr) {

  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dateStr);
}
function toUTCISOString(date, time = '12:00') {
  // Accepts date as YYYY-MM-DD and time as HH:MM (24h)
  // Always use noon (12:00) as default time to avoid timezone shifts
  if (!date) return null;
  let d;
  
  try {
    if (typeof date === 'string') {
      if (date.includes('T')) {
        // Parse ISO string and adjust to local noon
        d = new Date(date);
      } else {
        // Parse YYYY-MM-DD format
        const [year, month, day] = date.split('-').map(Number);
        // Create date at local noon
        d = new Date(year, month - 1, day);
      }
    } else if (date instanceof Date) {
      d = new Date(date);
    } else {
      return null;
    }

    // Set to local noon (12:00)
    const localNoon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
    
    // Add timezone offset to ensure it stays at noon UTC
    const timezoneOffset = localNoon.getTimezoneOffset() * 60000; // Convert to milliseconds
    const noonUTC = new Date(localNoon.getTime() + timezoneOffset);
    
    return noonUTC.toISOString();
  } catch (err) {
    console.error('Error converting date to UTC ISO:', err);
    return null;
  }
}

// Get public booking availability
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    
    let query = `
      SELECT 
        b.booking_id,
        COALESCE(b.reference_number, 'BPB' || TO_CHAR(b.created_at, 'YYMMDD') || LPAD(b.booking_id::text, 4, '0')) as reference_number,
        TO_CHAR(b.start_date, 'YYYY-MM-DD') as start_date,
        TO_CHAR(b.end_date, 'YYYY-MM-DD') as end_date,
        b.start_time,
        b.end_time,
        b.status,
        b.special_requests,
        b.admin_notes,
        b.room_type,
        TO_CHAR(b.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
        b.owner_first_name as customer_first_name,
        b.owner_last_name as customer_last_name,
        b.owner_email as customer_email,
        b.owner_phone as customer_phone,
        b.owner_address as customer_address,
        b.pet_name,
        b.pet_type,
        b.weight_category,
        b.breed,
        b.gender AS sex,

        s.service_name,
        s.service_type,
        sc.category_name
      FROM bookings b
      
      
      JOIN services s ON b.service_id = s.service_id
      JOIN service_categories sc ON s.category_id = sc.category_id
    `;
    
    const queryParams = [];
    
    if (date) {
      query += ' WHERE b.start_date = $1';
      queryParams.push(date);
    }
    
    query += ' ORDER BY b.created_at DESC';
    
    const { rows: bookings } = await pool.query(query, queryParams);
    
    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get all pending bookings (admin)
router.get('/pending', async (req, res) => {
  try {
    const { rows: bookings } = await pool.query(`
      SELECT 
        b.booking_id,
        COALESCE(b.reference_number, 'BPB' || TO_CHAR(b.created_at, 'YYMMDD') || LPAD(b.booking_id::text, 4, '0')) as reference_number,
        CONCAT(b.owner_first_name, ' ', b.owner_last_name) AS owner_name,
        b.owner_email,
        b.owner_phone,
        b.pet_name,
        b.pet_type::text,
        b.weight_category::text,
        b.start_date,
        b.end_date,
        b.start_time,
        b.end_time,
        b.room_type::text,
        b.status::text,
        b.special_requests,
        b.created_at,
        b.updated_at,
        s.service_name,
        s.service_type::text,
        sc.category_name
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      JOIN service_categories sc ON s.category_id = sc.category_id
      WHERE b.status::text = 'pending'
      ORDER BY b.created_at ASC
    `);
    
    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching pending bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get bookings by email or booking_id
router.get('/search', async (req, res) => {
  try {
    // Accept both camelCase and snake_case for reference number
    const email = req.query.email;
    let reference_number = req.query.reference_number || req.query.referenceNumber;

    if (!email && !reference_number) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either email or reference number'
      });
    }
    
    let query = `
      SELECT 
        b.booking_id,
        COALESCE(b.reference_number, 'BPB' || TO_CHAR(b.created_at, 'YYMMDD') || LPAD(b.booking_id::text, 4, '0')) as reference_number,
        CONCAT(b.owner_first_name, ' ', b.owner_last_name) AS owner_name,
        b.owner_email,
        b.owner_phone,
        b.pet_name,
        b.pet_type::text,
        b.weight_category::text,
        b.start_date,
        b.end_date,
        b.start_time,
        b.end_time,
        b.room_type::text,
        b.status::text,
        b.special_requests,
        b.created_at,
        b.updated_at,
        s.service_name,
        s.service_type::text,
        sc.category_name
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      JOIN service_categories sc ON s.category_id = sc.category_id
      WHERE 
    `;
    
    const params = [];
    
    if (email) {
      query += ' b.owner_email = $1';
      params.push(email);
    } else {
      // Remove # prefix if present and convert to uppercase
      const cleanRef = reference_number.replace(/^#/, '').toUpperCase();
      query += ' b.reference_number = $1';
      params.push(cleanRef);
    }
    
    query += ' ORDER BY b.created_at DESC';
    
    const { rows: bookings } = await pool.query(query, params);
    
    if (bookings.length === 0) {
      return res.status(404).json({
        success: false, 
        message: email 
          ? `No bookings found for email ${email}` 
          : reference_number
          ? `No booking found with reference number ${reference_number}`
          : `No booking found with ID ${booking_id}`
      });
    }
    
    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Error searching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update booking end date or status
// If request body contains newEndDate (and not status), treat as extension

// Update booking status (confirm, cancel, complete)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, adminId, reason } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'confirmed', 'completed', 'complete', 'cancelled', 'no-show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid status value',
        validValues: validStatuses
      });
    }
    
    let query;
    let params;
    
    switch (status) {
      case 'confirmed':
        query = `
          UPDATE bookings 
          SET 
            status = 'confirmed'::booking_status,
            confirmed_by = $1,
            confirmed_at = CURRENT_TIMESTAMP,
            admin_notes = $2
          WHERE booking_id = $3
        `;
        params = [adminId || null, notes || null, id];
        break;
        
      case 'cancelled':
        query = `
          UPDATE bookings 
          SET 
            status = 'cancelled'::booking_status,
            cancelled_by = $1,
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_reason = $2,
            admin_notes = $3
          WHERE booking_id = $4
        `;
        params = [adminId || null, reason || null, notes || null, id];
        break;
        
      case 'completed':
      case 'complete':
        query = `
          UPDATE bookings 
          SET 
            status = 'completed'::booking_status,
            completed_at = CURRENT_TIMESTAMP,
            -- If the booking was supposed to end in the future, trim it to today so the remaining nights become available
            end_date = CASE 
                        WHEN end_date > CURRENT_DATE THEN CURRENT_DATE 
                        ELSE end_date 
                      END,
            admin_notes = $1
          WHERE booking_id = $2
        `;
        params = [notes || null, id];
        break;
        
      case 'no-show':
        query = `
          UPDATE bookings 
          SET 
            status = 'no-show'::booking_status,
            cancelled_at = CURRENT_TIMESTAMP,
            admin_notes = $1
          WHERE booking_id = $2
        `;
        params = [notes || null, id];
        break;
        
      default:
        query = `
          UPDATE bookings 
          SET 
            status = $1::booking_status,
            admin_notes = $2
          WHERE booking_id = $3
        `;
        params = [status, notes || null, id];
    }
    
    const { rowCount } = await pool.query(query, params);
    
    if (rowCount === 0) {
      return res.status(404).json({
        success: false, 
        message: 'Booking not found'
      });
    }
    
    // Send status update email (non-blocking)
    (async () => {
      try {
        const { rows: bookingRows } = await pool.query(`
          SELECT 
            b.*,
            b.status::text as status,
            b.room_type::text as room_type,
            b.pet_type::text as pet_type,
            b.weight_category::text as weight_category,
            s.service_name,
            s.service_type::text as service_type
          FROM bookings b
          LEFT JOIN services s ON b.service_id = s.service_id
          WHERE b.booking_id = $1`, [id]);
        if (bookingRows.length) {
          await emailService.sendBookingStatusUpdate({ ...bookingRows[0], status });
        }
      } catch (emailErr) {
        console.error('Failed to send booking status update email:', emailErr.message);
      }
    })();

    // Notify frontend client that status was updated successfully
    return res.json({
      success: true,
      message: `Booking status updated to ${status} successfully`,
      data: { status }
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating booking status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});


// Extend booking end date
router.patch('/:id/extend', async (req, res) => {
  try {
    const { id } = req.params;
    const { newEndDate, adminId, notes } = req.body;

    if (!newEndDate) {
      return res.status(400).json({
        success: false,
        message: 'newEndDate is required'
      });
    }

    // Ensure newEndDate is later than current end_date
    const { rows: currentRows } = await pool.query('SELECT end_date FROM bookings WHERE booking_id = $1', [id]);
    if (!currentRows.length) {
      return res.status(404).json({ success:false, message:'Booking not found'});
    }
    const currentEnd = currentRows[0].end_date;
    if (currentEnd && new Date(newEndDate) <= currentEnd) {
      return res.status(400).json({ success:false, message:'New end date must be after current end date'});
    }

    await pool.query(`UPDATE bookings SET end_date = $1, admin_notes = COALESCE($2, admin_notes), updated_at = CURRENT_TIMESTAMP WHERE booking_id = $3`, [newEndDate, notes || null, id]);

    // Optionally send email about extension (non-blocking)
    (async () => {
      try {
        const { rows: bRows } = await pool.query('SELECT * FROM bookings WHERE booking_id = $1', [id]);
        if (bRows.length) {
          await emailService.sendBookingStatusUpdate({ ...bRows[0], status:'extended' });
        }
      } catch(e){ console.error('Email error after extend', e);}  
    })();

    return res.json({ success:true, message:'Booking extended successfully', data:{ newEndDate } });
  } catch (err) {
    console.error('Error extending booking:', err);
    res.status(500).json({ success:false, message:'Error extending booking', error: process.env.NODE_ENV==='development'? err.message:'Internal server error' });
  }
});

// Generic update route – currently supports extending booking via end_date
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { end_date, newEndDate, notes, adminId } = req.body;

    const targetEnd = newEndDate || end_date;
    if (!targetEnd) {
      return res.status(400).json({ success:false, message:'Nothing to update' });
    }

    // Check booking exists and current end_date
    const { rows: currentRows } = await pool.query('SELECT end_date FROM bookings WHERE booking_id = $1', [id]);
    if (!currentRows.length) {
      return res.status(404).json({ success:false, message:'Booking not found'});
    }
    const currentEnd = currentRows[0].end_date;
    if (currentEnd && new Date(targetEnd) <= currentEnd) {
      return res.status(400).json({ success:false, message:'New end date must be after current end date'});
    }

    await pool.query(`UPDATE bookings SET end_date = $1, admin_notes = COALESCE($2, admin_notes), updated_at = CURRENT_TIMESTAMP WHERE booking_id = $3`, [targetEnd, notes || null, id]);

    // non-blocking email
    (async () => {
      try {
        const { rows: bRows } = await pool.query('SELECT * FROM bookings WHERE booking_id = $1', [id]);
        if (bRows.length) {
          await emailService.sendBookingStatusUpdate({ ...bRows[0], status:'extended' });
        }
      } catch(e){ console.error('Email error after generic extend', e);}  
    })();

    return res.json({ success:true, message:'Booking updated', data:{ end_date: targetEnd } });
  } catch(err){
    console.error('Error updating booking:', err);
    res.status(500).json({ success:false, message:'Error updating booking', error: process.env.NODE_ENV==='development'? err.message:'Internal server error' });
  }
});

module.exports = router;