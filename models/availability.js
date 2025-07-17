/**
 * Availability Model
 * Handles all database interactions for checking room and service availability
 */

const { pool, formatDateString } = require('../config/db');

// Service ID to room type mapping for reference
const SERVICE_TYPE_MAP = {
  // Overnight services (IDs 1, 6, 7)
  1: { type: 'overnight', roomType: 'deluxe' },    // Deluxe Room (ID 1)
  6: { type: 'overnight', roomType: 'premium' },   // Premium Room (ID 6)
  7: { type: 'overnight', roomType: 'executive' }, // Executive Room (ID 7)
  
  // Other services
  2: { type: 'daycare', roomType: null },       // Daycare
  3: { type: 'grooming', roomType: 'basic' },   // Basic grooming
  4: { type: 'grooming', roomType: 'special' }, // Special grooming
  5: { type: 'grooming', roomType: 'premium' }  // Premium grooming
};

// Define total capacity by room type
const TOTAL_CAPACITY = {
  overnight: {
    deluxe: 8,
    premium: 5,
    executive: 2,
    total: 15
  },
  grooming: {
    basic: 8,
    special: 6,
    premium: 4
  },
  daycare: {
    total: 15
  }
};

/**
 * Get room availability for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Availability data by service and room type
 */
async function getRoomAvailability(date) {
  console.log('Starting getRoomAvailability for date:', date);
  try {
    // Format date if it's not already formatted
    const formattedDate = formatDateString(date);
    
    console.log('Querying overnight bookings...');
    // Get all bookings in a single query
    console.log('Executing optimized single query for all bookings...');
    const { rows: allBookings } = await pool.query(
      `SELECT s.service_type, b.service_id, COUNT(*) as count 
       FROM bookings b
       JOIN services s ON b.service_id = s.service_id
       WHERE b.start_date <= $1 AND b.end_date >= $1
       AND b.status::text NOT IN ('completed', 'cancelled', 'no-show')
       GROUP BY s.service_type, b.service_id`,
      [formattedDate]
    );
    
    console.log('All bookings query complete, results:', allBookings);
    
    // Separate bookings by service type
    const overnightBookings = allBookings.filter(b => b.service_type === 'overnight');
    const daycareBookings = allBookings.filter(b => b.service_type === 'daycare');
    const groomingBookings = allBookings.filter(b => b.service_type === 'grooming');
    
    // Calculate availability
    const availability = {
      overnight: {
        deluxe: { total: TOTAL_CAPACITY.overnight.deluxe, available: TOTAL_CAPACITY.overnight.deluxe },
        premium: { total: TOTAL_CAPACITY.overnight.premium, available: TOTAL_CAPACITY.overnight.premium },
        executive: { total: TOTAL_CAPACITY.overnight.executive, available: TOTAL_CAPACITY.overnight.executive }
      },
      daycare: { total: TOTAL_CAPACITY.daycare.total, available: TOTAL_CAPACITY.daycare.total },
      grooming: {
        basic: { total: TOTAL_CAPACITY.grooming.basic, available: TOTAL_CAPACITY.grooming.basic },
        special: { total: TOTAL_CAPACITY.grooming.special, available: TOTAL_CAPACITY.grooming.special },
        premium: { total: TOTAL_CAPACITY.grooming.premium, available: TOTAL_CAPACITY.grooming.premium }
      }
    };
    
    // Update availability based on overnight bookings
    overnightBookings.forEach(booking => {
      const serviceInfo = SERVICE_TYPE_MAP[booking.service_id] || { type: 'overnight', roomType: 'deluxe' };
      const roomType = serviceInfo.roomType;
      
      if (availability.overnight[roomType]) {
        availability.overnight[roomType].available = Math.max(0, 
          availability.overnight[roomType].total - booking.count);
      }
    });
    
    // Update daycare availability
    if (daycareBookings.length > 0 && daycareBookings[0].count) {
      availability.daycare.available = Math.max(0, 
        availability.daycare.total - daycareBookings[0].count);
    }
    
    // Update grooming availability
    groomingBookings.forEach(booking => {
      const serviceInfo = SERVICE_TYPE_MAP[booking.service_id] || { type: 'grooming', roomType: 'basic' };
      const roomType = serviceInfo.roomType;
      
      if (roomType && availability.grooming[roomType]) {
        availability.grooming[roomType].available = Math.max(0, 
          availability.grooming[roomType].total - booking.count);
      }
    });
    
    return {
      success: true,
      data: {
        date: formattedDate,
        availability: availability
      },
      message: "Availability retrieved successfully",
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error calculating room availability:', error);
    return { 
      success: false,
      error: true,
      message: 'Error getting room availability: ' + error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Check if a specific room/service is available on a given date
 * @param {string} date - Date in YYYY-MM-DD format 
 * @param {string} serviceType - Type of service ('overnight', 'daycare', 'grooming')
 * @param {string} roomType - Type of room (for overnight/grooming)
 * @param {number} serviceId - Service ID from the services table
 * @returns {Object} Availability information
 */
async function checkServiceAvailability(date, serviceType, roomType, serviceId) {
  try {
    const formattedDate = formatDateString(date);
    const availability = await getRoomAvailability(formattedDate);
    
    if (!availability.success) {
      return availability; // Return error response
    }
    
    let isAvailable = false;
    let availableSlots = 0;
    let totalSlots = 0;
    
    // Get availability based on service type and room type
    if (serviceType === 'overnight' && roomType) {
      if (availability.data.availability.overnight[roomType]) {
        availableSlots = availability.data.availability.overnight[roomType].available;
        totalSlots = availability.data.availability.overnight[roomType].total;
        isAvailable = availableSlots > 0;
      }
    } else if (serviceType === 'daycare') {
      availableSlots = availability.data.availability.daycare.available;
      totalSlots = availability.data.availability.daycare.total;
      isAvailable = availableSlots > 0;
    } else if (serviceType === 'grooming' && roomType) {
      if (availability.data.availability.grooming[roomType]) {
        availableSlots = availability.data.availability.grooming[roomType].available;
        totalSlots = availability.data.availability.grooming[roomType].total;
        isAvailable = availableSlots > 0;
      }
    }
    
    // Check if date is blocked in the unavailable_dates table
    const { rows: blockedDates } = await pool.query(
      `SELECT * FROM calendar_availability 
       WHERE date = $1 
       AND is_available = FALSE`,
      [formattedDate]
    );
    
    // If date is blocked, set availability to false
    if (blockedDates.length > 0) {
      isAvailable = false;
      availableSlots = 0;
    }
    
    return {
      success: true,
      data: {
        date: formattedDate,
        serviceType,
        roomType,
        serviceId,
        isAvailable,
        availableSlots,
        totalSlots,
        isBlocked: blockedDates.length > 0
      },
      message: isAvailable ? "Service is available" : "Service is not available",
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error checking service availability:', error);
    return {
      success: false,
      error: true,
      message: 'Error checking availability: ' + error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get unavailable dates for a specific service type and room type
 * @param {string} serviceType - Type of service
 * @param {string} roomType - Type of room
 * @param {Date} startDate - Start date for range
 * @param {Date} endDate - End date for range
 * @returns {Object} List of unavailable dates
 */
async function getUnavailableDates(serviceType, roomType, startDate, endDate) {
  try {
    const formattedStart = formatDateString(startDate);
    const formattedEnd = formatDateString(endDate);
    
    // Query manually blocked dates from unavailable_dates table
    const { rows: blockedDates } = await pool.query(
      `SELECT date, reason FROM calendar_availability 
       WHERE date BETWEEN $1 AND $2 
       AND is_available = FALSE`,
      [formattedStart, formattedEnd]
    );
    
    // Calculate unavailable dates based on capacity
    const dates = [];
    let currentDate = new Date(formattedStart);
    const endDateObj = new Date(formattedEnd);
    
    while (currentDate <= endDateObj) {
      const dateString = formatDateString(currentDate);
      const availability = await checkServiceAvailability(dateString, serviceType, roomType);
      
      if (!availability.data?.isAvailable) {
        dates.push({
          date: dateString,
          service_type: serviceType,
          room_type: roomType,
          reason: availability.data?.isBlocked ? "Manually blocked" : "No available slots"
        });
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Combine manually blocked dates and capacity-based unavailable dates
    const allDates = [...blockedDates, ...dates.filter(d => 
      !blockedDates.some(bd => bd.date === d.date))];
    
    return {
      success: true,
      data: {
        unavailableDates: allDates,
        serviceType,
        roomType
      },
      message: `Retrieved ${allDates.length} unavailable dates`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting unavailable dates:', error);
    return {
      success: false,
      error: true,
      message: 'Error getting unavailable dates: ' + error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getRoomAvailability,
  checkServiceAvailability,
  getUnavailableDates,
  TOTAL_CAPACITY,
  SERVICE_TYPE_MAP
};
