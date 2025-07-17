/**
 * Availability Routes
 * Handles all routes related to room and service availability
 */

const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const pool = require('../db');
const bookingController = require('../controllers/bookingController');

// Get room availability for a specific date
router.get('/room-availability', availabilityController.getRoomAvailability);

// Check if a specific service is available on a date
router.get('/service-availability', availabilityController.checkServiceAvailability);

// Get unavailable dates for a service
router.get('/unavailable-dates', availabilityController.getUnavailableDates);

// Get calculated unavailable dates (for compatibility with frontend)
router.get('/calculated-unavailable-dates', availabilityController.getUnavailableDates);

// Count bookings by service and room type for a specific date
// This endpoint is needed by the frontend's ServiceAvailabilityContext
router.get('/count-bookings', bookingController.countBookingsByServiceAndRoom);

// GET /api/availability?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ success: false, message: 'Date query parameter is required.' });
  }
  try {
    const { rows: results } = await pool.query(
      `SELECT 
        s.service_id, 
        s.service_name, 
        s.max_slots AS total_slots,
        (s.max_slots - COALESCE(
          (SELECT COUNT(*)
           FROM bookings b
           WHERE b.service_id = s.service_id
           AND b.start_date = $1
           AND b.status::text IN ('pending', 'confirmed')
          ), 0
        )) AS available_slots
      FROM services s
      ORDER BY s.service_name`,
      [date]
    );
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching availability', error: error.message });
  }
});

module.exports = router;
