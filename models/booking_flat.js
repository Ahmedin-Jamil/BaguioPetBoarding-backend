/**
 * Booking Model (Flattened version)
 * Handles all database interactions for simplified bookings schema
 */

const { pool, formatDateString } = require('../config/db');
const { SERVICE_TYPE_MAP } = require('./availability');

/**
 * Get paginated list of bookings with optional filters
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

    const where = [];
    const params = [];

    let paramIndex = 1;
    if (status)      { where.push(`b.status = $${paramIndex}`);          params.push(status); paramIndex++; }
    if (serviceType)  { where.push(`s.service_type = $${paramIndex}`);    params.push(serviceType); paramIndex++; }
    if (roomType)     { where.push(`b.room_type = $${paramIndex}`);       params.push(roomType); paramIndex++; }
    if (startDate)    { where.push(`b.start_date >= $${paramIndex}`);     params.push(formatDateString(startDate)); paramIndex++; }
    if (endDate)      { where.push(`b.end_date <= $${paramIndex}`);       params.push(formatDateString(endDate)); paramIndex++; }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset   = (page - 1) * limit;

    const dataQuery = `
      SELECT b.*, s.service_name, s.service_type
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      ${whereSql}
      ORDER BY ${sortBy} ${sortDir}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      ${whereSql}`;

    const { rows } = await pool.query(dataQuery, [...params, limit, offset]);
    const { rows: countRows } = await pool.query(countQuery, params);
    const total = parseInt(countRows[0].total, 10);

    return {
      success: true,
      data: {
        bookings: rows,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) }
      },
      message: `Retrieved ${rows.length} bookings`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting bookings:', error);
    return { success: false, message: `Error retrieving bookings: ${error.message}`, timestamp: new Date().toISOString() };
  }
}

/**
 * Retrieve a single booking by ID
 */
async function getBookingById(id) {
  try {
    const query = `
      SELECT b.*, s.service_name, s.service_type
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.service_id
      WHERE b.booking_id = $1`;

    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return { success: false, message: 'Booking not found', timestamp: new Date().toISOString() };
    }
    return { success: true, data: rows[0], message: 'Booking retrieved', timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Error getting booking:', error);
    return { success: false, message: `Error retrieving booking: ${error.message}`, timestamp: new Date().toISOString() };
  }
}

/**
 * Count bookings for dashboard capacity checks
 */
async function countBookingsByServiceAndRoom(date, serviceType, roomType) {
  try {
    const formattedDate = formatDateString(date);
    let query           = '';
    let queryParams     = [formattedDate];

    if (serviceType === 'overnight' && roomType) {
      const serviceIds = Object.entries(SERVICE_TYPE_MAP)
        .filter(([id, info]) => info.type === 'overnight' && info.roomType === roomType.toLowerCase())
        .map(([id]) => parseInt(id, 10));
      if (serviceIds.length === 0) return 0;
      query       = `SELECT COUNT(*) AS count FROM bookings b JOIN services s ON b.service_id = s.service_id WHERE s.service_type = $1 AND b.start_date = $2 AND b.service_id IN (${serviceIds.join(',')}) AND b.status NOT IN ('completed','cancelled','no-show')`;
      queryParams = [serviceType, formattedDate];
    } else if (serviceType === 'grooming' && roomType) {
      const serviceIds = Object.entries(SERVICE_TYPE_MAP)
        .filter(([id, info]) => info.type === 'grooming' && info.roomType === roomType.toLowerCase())
        .map(([id]) => parseInt(id, 10));
      if (serviceIds.length === 0) return 0;
      query       = `SELECT COUNT(*) AS count FROM bookings b JOIN services s ON b.service_id = s.service_id WHERE s.service_type = $1 AND b.start_date = $2 AND b.service_id IN (${serviceIds.join(',')}) AND b.status NOT IN ('completed','cancelled','no-show')`;
      queryParams = [serviceType, formattedDate];
    } else {
      query       = `SELECT COUNT(*) AS count FROM bookings b JOIN services s ON b.service_id = s.service_id WHERE s.service_type = $1 AND b.start_date = $2 AND b.status NOT IN ('completed','cancelled','no-show')`;
      queryParams = [serviceType, formattedDate];
    }

    const { rows } = await pool.query(query, queryParams);
    return rows.length ? parseInt(rows[0].count, 10) : 0;
  } catch (error) {
    console.error('Error counting bookings:', error);
    return 0;
  }
}

/**
 * Create a new booking (flattened schema)
 */
async function createBooking(bookingData) {
  try {
    // ---- Normalise payload to flat columns ----
    const owner = bookingData.owner_first_name ? bookingData : (bookingData.guest_user || {});
    const pet   = bookingData.pet_name        ? bookingData : (bookingData.guest_pet  || {});

    // Helper to split a full name into first / last
function splitFullName(full = '') {
  const parts = full.trim().split(/\s+/);
  const first = parts.shift() || '';
  const last  = parts.join(' ');
  return { first, last };
}

const data = {
      owner_first_name: owner.first_name    || owner.firstName    || owner.name         || bookingData.owner_first_name || (bookingData.ownerName ? splitFullName(bookingData.ownerName).first : ''),
      owner_last_name : owner.last_name     || owner.lastName     || bookingData.owner_last_name || (bookingData.ownerName ? splitFullName(bookingData.ownerName).last : ''),
      owner_email     : owner.email         || bookingData.owner_email || bookingData.ownerEmail || '',
      owner_phone     : owner.phone         || bookingData.owner_phone || bookingData.ownerPhone || '',
      owner_address   : owner.address       || bookingData.owner_address || null,

      pet_name        : pet.pet_name        || pet.name          || bookingData.pet_name || '',
      pet_type        : pet.pet_type        || pet.type          || bookingData.pet_type || 'Dog',
      breed           : pet.breed           || bookingData.breed || null,
      gender          : pet.gender          || pet.sex           || bookingData.gender || null,
      date_of_birth   : pet.date_of_birth   || bookingData.date_of_birth || null,
      weight_category : pet.weight_category || pet.weightCategory || bookingData.weight_category || 'Medium',

      // ----- OWNER NAME FALLBACKS -----
      // If first/last names are missing but a combined owner_name exists, split it
      ...(function () {
        let first = bookingData.owner_first_name || bookingData.ownerFirstName;
        let last  = bookingData.owner_last_name  || bookingData.ownerLastName;

        const fullName = bookingData.owner_name || (bookingData.guest_user && bookingData.guest_user.name);
        if ((!first || !last) && fullName) {
          const parts = fullName.trim().split(' ');
          if (!first) first = parts.shift();
          if (!last)  last  = parts.join(' ');
        }
        return {
          owner_first_name: first || null,
          owner_last_name : last  || null
        };
      })(),

      service_id      : bookingData.service_id || bookingData.serviceId,
      room_type       : bookingData.room_type  || bookingData.roomType || null,
      start_date      : bookingData.start_date || bookingData.booking_date,
      end_date        : bookingData.end_date   || bookingData.endDate   || null,
      start_time      : bookingData.start_time || bookingData.startTime || null,
      end_time        : bookingData.end_time   || bookingData.endTime   || null,
      total_amount    : bookingData.total_amount || 0,
      special_requests: bookingData.special_requests || bookingData.specialRequests || bookingData.additionalInfo || bookingData.additional_info || null,
      grooming_type   : bookingData.grooming_type || null
    };

    await pool.query('BEGIN');

    try {
      // Generate reference number e.g. BPB250709103045321
      const now              = new Date();
      const refBase          = now.toISOString().replace(/[-T:Z.]/g,'').slice(2,14);
      const referenceNumber  = `BPB${refBase}${Math.floor(Math.random()*900+100)}`;

      const { rows: [inserted] } = await pool.query(
        `INSERT INTO bookings (
          reference_number, owner_first_name, owner_last_name, owner_email, owner_phone, owner_address,
          pet_name, pet_type, breed, gender, date_of_birth, weight_category,
          service_id, room_type, start_date, end_date, start_time, end_time,
          total_amount, special_requests, grooming_type, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21, 'pending')
        RETURNING booking_id`,
        [referenceNumber,
          data.owner_first_name, data.owner_last_name, data.owner_email, data.owner_phone, data.owner_address,
          data.pet_name, data.pet_type, data.breed, data.gender, data.date_of_birth, data.weight_category,
          data.service_id, data.room_type, formatDateString(data.start_date),
          data.end_date ? formatDateString(data.end_date) : null,
          data.start_time, data.end_time, data.total_amount, data.special_requests, data.grooming_type]
      );

      const bookingId = inserted.booking_id;
      await pool.query('COMMIT');

      return await getBookingById(bookingId);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Error creating booking:', error);
    return { success: false, message: `Error creating booking: ${error.message}`, timestamp: new Date().toISOString() };
  }
}

/**
 * Update booking status (admin actions)
 */
async function updateBookingStatus(id, status) {
  try {
    const validStatuses = ['pending','confirmed','completed','cancelled','no-show'];
    if (!validStatuses.includes(status)) {
      return { success: false, message: 'Invalid status value', timestamp: new Date().toISOString() };
    }

    const { rowCount } = await pool.query('UPDATE bookings SET status = $1 WHERE booking_id = $2', [status, id]);
    if (rowCount === 0) {
      return { success: false, message: 'Booking not found', timestamp: new Date().toISOString() };
    }

    return { success: true, data: { booking_id: id, status }, message: 'Booking status updated', timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Error updating booking status:', error);
    return { success: false, message: `Error updating booking status: ${error.message}`, timestamp: new Date().toISOString() };
  }
}

/**
 * Summary counts by service for a given date (dashboard)
 */
async function getBookingSummary(date) {
  try {
    const query = `
      SELECT b.start_date, s.service_name, s.service_type,
             COUNT(*) AS total_bookings,
             SUM(CASE WHEN b.status = 'pending'   THEN 1 ELSE 0 END) AS pending_count,
             SUM(CASE WHEN b.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count,
             SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
             SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
             SUM(b.total_amount) AS total_revenue
      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      WHERE b.start_date = $1
      GROUP BY b.start_date, s.service_id, s.service_name, s.service_type
      ORDER BY s.service_type, s.service_name`;

    const { rows } = await pool.query(query, [formatDateString(date)]);

    rows.forEach(item => {
      const serviceInfo = SERVICE_TYPE_MAP[item.service_id];
      if (serviceInfo) item.room_type = serviceInfo.roomType;
    });

    return { success: true, data: rows, message: `Summary for ${date}`, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Error getting booking summary:', error);
    return { success:false, message:`Error retrieving booking summary: ${error.message}`, timestamp:new Date().toISOString() };
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
