/**
 * Booking Model
 * Handles all database interactions for bookings
 */

const { pool, formatDateString } = require('../config/db');
const { SERVICE_TYPE_MAP } = require('./availability');

/**
 * Get all bookings with pagination and filtering
 * @param {Object} options - Query options including filters, pagination, etc.
 * @returns {Object} Bookings data and pagination info
 */
async function getBookings(options = {}) {
  try {
    const {
      status,
      serviceType,
      roomType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'start_date',
      sortDir = 'DESC'
    } = options;

    let where = [];
    let params = [];

    if (status) { where.push('b.status = ?'); params.push(status); }
    if (serviceType) { where.push('s.service_type = ?'); params.push(serviceType); }
    if (roomType) { where.push('b.room_type = ?'); params.push(roomType); }
    if (startDate) { where.push('b.start_date >= ?'); params.push(formatDateString(startDate)); }
    if (endDate) { where.push('b.end_date <= ?'); params.push(formatDateString(endDate)); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page-1)*limit;

    const dataQuery = `
      SELECT b.*, s.service_name, s.service_type, u.first_name, u.last_name, u.email, u.phone, u.address
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      LEFT JOIN users u ON b.user_id = u.user_id
      ${whereSql}
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ? OFFSET ?`;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      ${whereSql}`;

    const [rows] = await pool.query(dataQuery, [...params, limit, offset]);
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0].total;

    return {
      success:true,
      data:{ bookings: rows, pagination:{ total, page, limit, pages: Math.ceil(total/limit) } },
      message:`Retrieved ${rows.length} bookings`,
      timestamp:new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting bookings:', error);
    return { success:false, message:'Error retrieving bookings: '+error.message, timestamp:new Date().toISOString() };
  }
}
  try {
    const {
      status,
      serviceType,
      roomType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'start_date',
      sortDir = 'DESC'
    } = options;
    
    // Build the WHERE clause based on filters
    let whereClause = [];
    let queryParams = [];
    
    if (status) {
      whereClause.push('b.status = ?');
      queryParams.push(status);
    }
    
    if (serviceType) {
      whereClause.push('s.service_type = ?');
      queryParams.push(serviceType);
    }
    
    if (startDate) {
      whereClause.push('b.start_date >= ?');
      queryParams.push(formatDateString(startDate));
    }
    
    if (endDate) {
      whereClause.push('b.start_date <= ?');
      queryParams.push(formatDateString(endDate));
    }
    
    // For room type filtering, we need to map to service_ids
    if (roomType && serviceType === 'overnight') {
      // Get service IDs that match this room type
      const serviceIds = Object.entries(SERVICE_TYPE_MAP)
        .filter(([id, info]) => info.type === 'overnight' && info.roomType === roomType)
        .map(([id]) => parseInt(id, 10));
      
      if (serviceIds.length > 0) {
        whereClause.push(`b.service_id IN (${serviceIds.join(',')})`);
      }
    }
    
    // Prepare the WHERE clause for the query
    const whereStatement = whereClause.length > 0 
      ? `WHERE ${whereClause.join(' AND ')}` 
      : '';
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Query to get paginated bookings
    const query = `
      SELECT 
        b.*,
        u.first_name, u.last_name, u.email, u.phone, u.address,
        p.pet_name, p.pet_type, p.breed, p.gender, p.age, p.weight,
        s.service_name, s.service_type, s.price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN pets p ON b.pet_id = p.pet_id
      LEFT JOIN services s ON b.service_id = s.service_id
      ${whereStatement}
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ? OFFSET ?
    `;
    
    // Query to count total results for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      ${whereStatement}
    `;
    
    // Execute both queries
    const [bookings] = await pool.query(query, [...queryParams, limit, offset]);
    const [countResult] = await pool.query(countQuery, queryParams);
    const total = countResult[0].total;
    
    // Add room type information based on service_id
    bookings.forEach(booking => {
      const serviceInfo = SERVICE_TYPE_MAP[booking.service_id];
      if (serviceInfo) {
        booking.room_type = serviceInfo.roomType;
      }
    });
    
    return {
      success: true,
      data: {
        bookings,
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(total / limit)
        }
      },
      message: `Retrieved ${bookings.length} bookings`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting bookings:', error);
    return {
      success: false,
      message: 'Error retrieving bookings: ' + error.message,
      timestamp: new Date().toISOString()
    };
  }


/**
 * Get booking details by ID
 * @param {number} id - Booking ID
 * @returns {Object} Booking details
 */
async function getBookingById(id) {
  try {
    const query = `
      SELECT b.*, s.service_name, s.service_type
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      WHERE b.booking_id = ?`;

    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      return { success:false, message:'Booking not found', timestamp:new Date().toISOString() };
    }
    return { success:true, data:rows[0], message:'Booking retrieved', timestamp:new Date().toISOString() };
  } catch (error) {
    console.error('Error getting booking:', error);
    return { success:false, message:'Error retrieving booking: '+error.message, timestamp:new Date().toISOString() };
  }
}
  try {
    const query = `
      SELECT 
        b.*,
        u.first_name, u.last_name, u.email, u.phone, u.address,
        p.pet_name, p.pet_type, p.breed, p.gender, p.age, p.weight,
        s.service_name, s.service_type, s.price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN pets p ON b.pet_id = p.pet_id
      LEFT JOIN services s ON b.service_id = s.service_id
      WHERE b.booking_id = ?
    `;
    
    const [bookings] = await pool.query(query, [id]);
    
    if (bookings.length === 0) {
      return {
        success: false,
        message: 'Booking not found',
        timestamp: new Date().toISOString()
      };
    }
    
    const booking = bookings[0];
    
    // Add room type information based on service_id
    const serviceInfo = SERVICE_TYPE_MAP[booking.service_id];
    if (serviceInfo) {
      booking.room_type = serviceInfo.roomType;
    }
    
    return {
      success: true,
      data: booking,
      message: 'Booking retrieved successfully',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting booking details:', error);
    return {
      success: false,
      message: 'Error retrieving booking: ' + error.message,
      timestamp: new Date().toISOString()
    };
  }


/**
 * Count bookings by service type and optionally room type for a specific date
 * This function is compatible with the frontend countBookingsByServiceAndRoom implementation
 * @param {string} date - Date to count bookings for
 * @param {string} serviceType - Service type (overnight, daycare, grooming)
 * @param {string} roomType - Room type (for overnight/grooming)
 * @returns {number} Number of bookings
 */
async function countBookingsByServiceAndRoom(date, serviceType, roomType) {
  try {
    const formattedDate = formatDateString(date);
    let query = '';
    let queryParams = [formattedDate];
    
    if (serviceType === 'overnight' && roomType) {
      // Get service IDs that match this room type for overnight
      const serviceIds = Object.entries(SERVICE_TYPE_MAP)
        .filter(([id, info]) => info.type === 'overnight' && info.roomType === roomType.toLowerCase())
        .map(([id]) => parseInt(id, 10));
      
      if (serviceIds.length === 0) return 0;
      
      query = `
        SELECT COUNT(*) as count FROM bookings b
        JOIN services s ON b.service_id = s.service_id
        WHERE s.service_type = ?
        AND b.start_date = ?
        AND b.service_id IN (${serviceIds.join(',')})
        AND b.status NOT IN ('completed', 'cancelled', 'no-show')
      `;
      queryParams = [serviceType, formattedDate];
      
    } else if (serviceType === 'grooming' && roomType) {
      // Get service IDs that match this grooming type
      const serviceIds = Object.entries(SERVICE_TYPE_MAP)
        .filter(([id, info]) => info.type === 'grooming' && info.roomType === roomType.toLowerCase())
        .map(([id]) => parseInt(id, 10));
      
      if (serviceIds.length === 0) return 0;
      
      query = `
        SELECT COUNT(*) as count FROM bookings b
        JOIN services s ON b.service_id = s.service_id
        WHERE s.service_type = ?
        AND b.start_date = ?
        AND b.service_id IN (${serviceIds.join(',')})
        AND b.status NOT IN ('completed', 'cancelled', 'no-show')
      `;
      queryParams = [serviceType, formattedDate];
      
    } else {
      // If no room type specified, count all bookings of the service type
      query = `
        SELECT COUNT(*) as count FROM bookings b
        JOIN services s ON b.service_id = s.service_id
        WHERE s.service_type = ?
        AND b.start_date = ?
        AND b.status NOT IN ('completed', 'cancelled', 'no-show')
      `;
      queryParams = [serviceType, formattedDate];
    }
    
    const [result] = await pool.query(query, queryParams);
    return result[0].count || 0;
  } catch (error) {
    console.error('Error counting bookings:', error);
    return 0;
  }
}

/**
 * Create a new booking
 * @param {Object} bookingData - Booking information
 * @returns {Object} Created booking details
 */
async function createBooking(bookingData) {
  /*
    bookingData is expected to contain either already-flattened owner/pet fields OR the legacy
    guest_user / guest_pet blocks. This helper normalises both styles into the new flat columns.
  */
  try {
    // ---- Normalise incoming payload ----
    const owner = bookingData.owner_first_name ? bookingData : (bookingData.guest_user || {});
    const pet   = bookingData.pet_name        ? bookingData : (bookingData.guest_pet  || {});

    const data = {
      owner_first_name: owner.first_name || owner.firstName || owner.name || bookingData.owner_first_name || '',
      owner_last_name : owner.last_name  || owner.lastName  || bookingData.owner_last_name || '',
      owner_email     : owner.email      || bookingData.owner_email || bookingData.ownerEmail || '',
      owner_phone     : owner.phone      || bookingData.owner_phone || bookingData.ownerPhone || '',
      owner_address   : owner.address    || bookingData.owner_address || null,

      pet_name        : pet.pet_name || pet.name || bookingData.pet_name || '',
      pet_type        : pet.pet_type || pet.type || bookingData.pet_type || 'Dog',
      breed           : pet.breed    || bookingData.breed || null,
      gender          : pet.gender   || pet.sex || bookingData.gender || null,
      date_of_birth   : pet.date_of_birth || bookingData.date_of_birth || null,
      weight_category : pet.weight_category || pet.weightCategory || bookingData.weight_category || 'Medium',

      service_id      : bookingData.service_id || bookingData.serviceId,
      room_type       : bookingData.room_type  || bookingData.roomType,
      start_date      : bookingData.start_date || bookingData.booking_date,
      end_date        : bookingData.end_date   || bookingData.endDate   || null,
      start_time      : bookingData.start_time || bookingData.startTime || null,
      end_time        : bookingData.end_time   || bookingData.endTime   || null,
      total_amount    : bookingData.total_amount || 0,
      special_requests: bookingData.special_requests || null,
      grooming_type   : bookingData.grooming_type || null
    };

    await pool.query('BEGIN');

    try {
      // Generate a simple reference number: BPB<YYMMDDHHMMSS><3-digit random>
      const now = new Date();
      const refBase = now.toISOString().replace(/[-T:Z.]/g,'').slice(2,14); // YYMMDDHHMMSS
      const referenceNumber = `BPB${refBase}${Math.floor(Math.random()*900+100)}`;

      const { rows: [result] } = await pool.query(
        `INSERT INTO bookings (
          reference_number, owner_first_name, owner_last_name, owner_email, owner_phone, owner_address,
          pet_name, pet_type, breed, gender, date_of_birth, weight_category,
          service_id, room_type, start_date, end_date, start_time, end_time,
          total_amount, special_requests, grooming_type, status
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending')`,
        [referenceNumber,
          data.owner_first_name, data.owner_last_name, data.owner_email, data.owner_phone, data.owner_address,
          data.pet_name, data.pet_type, data.breed, data.gender, data.date_of_birth, data.weight_category,
          data.service_id, data.room_type, formatDateString(data.start_date),
          data.end_date ? formatDateString(data.end_date) : null,
          data.start_time, data.end_time, data.total_amount, data.special_requests, data.grooming_type]
      );

      const bookingId = result.id;
      await pool.query('COMMIT');

      // Return full record
      return await getBookingById(bookingId);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Error creating booking:', error);
    return { success:false, message:'Error creating booking: '+error.message, timestamp:new Date().toISOString() };
  }
}
  try {
    await pool.query('BEGIN');

    try {
      const {
        service_id,
        start_date,
        end_date,
        start_time,
        end_time,
        total_amount,
        special_requests,
        weight_category,
        guest_user,
        guest_pet
      } = bookingData;

      // Insert guest user
      const guestFirstName = guest_user.first_name || guest_user.firstName || guest_user.name || '';
const guestLastName  = guest_user.last_name  || guest_user.lastName  || '';
const guestAddress   = guest_user.address    || guest_user.addressLine || '';

const { rows: [userResult] } = await pool.query(
        'INSERT INTO users (first_name, last_name, email, phone, address, is_guest) VALUES ($1, $2, $3, $4, $5, true) RETURNING *',
        [
          guestFirstName,
          guestLastName,
          guest_user.email,
          guest_user.phone,
          guestAddress
        ]
      );
      const userId = userResult.id;

      // Insert guest pet
      const { rows: [petResult] } = await pool.query(
        'INSERT INTO pets (user_id, pet_name, pet_type, breed, gender, date_of_birth, weight) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [
          userId,
          guest_pet.name,
          guest_pet.type,
          guest_pet.breed,
          guest_pet.gender || guest_pet.sex || null,
          guest_pet.date_of_birth || null,
          guest_pet.weight || 0
        ]
      );
      const petId = petResult.id;

      // Create the booking
      const { rows: [bookingResult] } = await pool.query(
        'INSERT INTO bookings (user_id, pet_id, service_id, start_date, end_date, start_time, end_time, weight_category, total_amount, special_requests, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
        [
          userId,
          petId,
          service_id,
          formatDateString(start_date),
          end_date ? formatDateString(end_date) : formatDateString(start_date),
          start_time || null,
          end_time || null,
          weight_category || null,
          total_amount,
          special_requests || null,
          'pending'
        ]
      );
      
      const bookingId = bookingResult.id;
      
      // Commit the transaction first
      await pool.query('COMMIT');

      // Retrieve full booking details (including joined user & pet info)
      const fullResult = await getBookingById(bookingId);

      // Fallback in case detailed retrieval fails
      if (!fullResult.success) {
        return {
          success: true,
          data: {
            booking_id: bookingId,
            user_id: userId,
            pet_id: petId,
            service_id,
            start_date: formatDateString(start_date),
            end_date: end_date ? formatDateString(end_date) : formatDateString(start_date),
            start_time,
            end_time,
            weight_category,
            total_amount,
            special_requests,
            status: 'pending'
          },
          message: 'Booking created successfully',
          timestamp: new Date().toISOString()
        };
      }

      // Merge the generated reference number (if any) or other metadata here if needed
      return {
        ...fullResult,
        message: 'Booking created successfully'
      };
    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error creating booking:', error);
    return {
      success: false,
      message: 'Error creating booking: ' + error.message,
      timestamp: new Date().toISOString()
    };
  }


/**
 * Update booking status
 * @param {number} id - Booking ID
 * @param {string} status - New status
 * @returns {Object} Update result
 */
async function updateBookingStatus(id, status) {
  try {
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];
    
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        message: 'Invalid status value',
        timestamp: new Date().toISOString()
      };
    }
    
    const [result] = await pool.query(
      'UPDATE bookings SET status = ? WHERE booking_id = ?',
      [status, id]
    );
    
    if (result.affectedRows === 0) {
      return {
        success: false,
        message: 'Booking not found',
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      success: true,
      data: { booking_id: id, status },
      message: 'Booking status updated successfully',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error updating booking status:', error);
    return {
      success: false,
      message: 'Error updating booking status: ' + error.message,
      timestamp: new Date().toISOString()
    };
  }
}
/**
 * Get booking summary by date
 * @param {string} date - Date to summarize bookings for
 * @returns {Object} Summary of bookings by service type
 */
async function getBookingSummary(date) {
  try {
    const query = `
      SELECT 
        b.start_date,
        s.service_name,
        s.service_type,
        COUNT(*) as total_bookings,
        SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN b.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
        SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(b.total_amount) as total_revenue
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      WHERE b.start_date = ?
      GROUP BY b.start_date, s.service_id, s.service_name, s.service_type
      ORDER BY s.service_type, s.service_name
    `;
    
    const [results] = await pool.query(query, [formatDateString(date)]);
    
    // Add room type information based on service_id
    results.forEach(item => {
      const serviceInfo = SERVICE_TYPE_MAP[item.service_id];
      if (serviceInfo) {
        item.room_type = serviceInfo.roomType;
      }
    });
    
    return {
      success: true,
      data: results,
      message: `Retrieved booking summary for ${date}`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting booking summary:', error);
    return {
      success: false,
      message: 'Error retrieving booking summary: ' + error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getBookings,
  getBookingById,
  countBookingsByServiceAndRoom,
  createBooking,
  updateBookingStatus,
  getBookingSummary
};
