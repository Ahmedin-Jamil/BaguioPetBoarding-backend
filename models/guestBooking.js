/**
 * Guest Booking Model
 * Handles bookings without requiring user authentication
 */

const pool = require('../config/database');

/**
 * Create a new guest booking
 */
async function createGuestBooking(bookingData) {
  try {
    await pool.query('BEGIN');

    const {
      ownerName,
      ownerEmail,
      ownerPhone,
      petName,
      petType,
      petBreed,
      weight,
      service_id,
      booking_date,
      end_date,
      start_time,
      end_time,
      total_amount,
      special_requests,
      room_type
    } = bookingData;

    // Calculate weight category for dogs
    let weightCategory = null;
    if (petType === 'Dog') {
      if (!weight) {
        throw new Error('Weight is required for dogs');
      }
      const weightNum = parseFloat(weight);
      // Weight ranges for dogs (in kg)
      // Small: 1-9 KG
      // Medium: 9-25 KG
      // Large: 25-40 KG
      // Extra-Large: 40+ KG
      if (weightNum <= 9) {
        weightCategory = 'Small';
      } else if (weightNum <= 25) {
        weightCategory = 'Medium';
      } else if (weightNum <= 40) {
        weightCategory = 'Large';
      } else {
        weightCategory = 'X-Large';
      }
    }

    // Insert booking directly with guest information
    const { rows: [booking] } = await pool.query(`
      INSERT INTO bookings (
        owner_name,
        owner_email,
        owner_phone,
        pet_name,
        pet_type,
        pet_breed,
        service_id,
        booking_date,
        end_date,
        start_time,
        end_time,
        total_amount,
        special_requests,
        room_type,
        status,
        weight_category
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [
      ownerName,
      ownerEmail,
      ownerPhone,
      petName,
      petType,
      petBreed,
      service_id,
      booking_date,
      end_date,
      start_time,
      end_time,
      total_amount,
      special_requests,
      room_type,
      weightCategory
    ]);

    await pool.query('COMMIT');
    return {
      success: true,
      bookingId: booking.id,
      referenceNumber: `BPB${booking.id.toString(36).toUpperCase()}`
    };
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

/**
 * Get booking by reference number or email
 */
async function getGuestBooking(searchParams) {
  const { email, referenceNumber } = searchParams;
  const [bookings] = await pool.query(`
    SELECT * FROM bookings 
    WHERE owner_email = ? OR reference_number = ?
    ORDER BY booking_date DESC
  `, [email, referenceNumber]);
  
  return bookings;
}

module.exports = {
  createGuestBooking,
  getGuestBooking
};
