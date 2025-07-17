const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { validateParams, validateQuery, schemas } = require('../middleware/validation');

// Get all available services with current slot availability
router.get('/', async (req, res) => {
  try {
    const { rows: services } = await pool.query(`
      SELECT 
        s.service_id,
        s.service_name,
        s.description,
        s.price_small,
        s.price_medium,
        s.price_large,
        s.price_xlarge,
        s.price_cat_small,
        s.price_cat_medium,
        s.duration_hours,
        s.max_slots,
        s.service_type::text,
        sc.category_name,
        COALESCE(
          (SELECT COUNT(*)
           FROM bookings b
           WHERE b.service_id = s.service_id
           AND b.start_date <= CURRENT_DATE
           AND (b.end_date >= CURRENT_DATE OR b.end_date IS NULL)
           AND b.status::text IN ('pending', 'confirmed')
          ), 0
        ) as booked_slots
      FROM services s
      JOIN service_categories sc ON s.category_id = sc.category_id
      ORDER BY sc.category_name, s.service_name
    `);
    
    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching services',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get service availability for a specific date
router.get('/availability/:date', validateParams(schemas.dateParam), async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD' });
    }

    const { rows: services } = await pool.query(`
      SELECT 
        s.service_id,
        s.service_name,
        s.description,
        s.price_small,
        s.price_medium,
        s.price_large,
        s.price_xlarge,
        s.price_cat_small,
        s.price_cat_medium,
        s.duration_hours,
        s.max_slots,
        s.service_type::text,
        sc.category_name,
        COALESCE(
          (SELECT COUNT(*)
           FROM bookings b
           WHERE b.service_id = s.service_id
           AND $1 BETWEEN b.start_date AND COALESCE(b.end_date, b.start_date)
           AND b.status::text IN ('pending', 'confirmed')
          ), 0
        ) as booked_slots
      FROM services s
      JOIN service_categories sc ON s.category_id = sc.category_id
      ORDER BY sc.category_name, s.service_name
    `, [date]);
    
    res.json(services);
  } catch (error) {
    console.error('Error fetching service availability:', error);
    res.status(500).json({
      message: 'Error fetching service availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Check calendar availability for a specific date
router.get('/calendar-availability/:date', validateParams(schemas.dateParam), async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD' });
    }
    
    const { rows: availability } = await pool.query(`
      SELECT 
        date,
        is_available,
        reason,
        notes
      FROM calendar_availability 
      WHERE date = $1
      UNION ALL
      SELECT 
        $2 as date,
        TRUE as is_available,
        NULL as reason,
        NULL as notes
      WHERE NOT EXISTS (
        SELECT 1 FROM calendar_availability WHERE date = $3
      )
    `, [date, date, date]);
    
    if (availability.length > 0) {
      res.json({
      success: true,
      data: availability[0]
    });
    } else {
      res.json({
      success: true,
      data: { date, is_available: true, reason: null, notes: null }
    });
    }
  } catch (error) {
    console.error('Error checking calendar availability:', error);
    res.status(500).json({
      message: 'Error checking calendar availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get calendar availability for a date range
router.get('/calendar-availability', validateQuery(schemas.dateRange), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Validate date format
    if (!startDate || !startDate.match(/^\d{4}-\d{2}-\d{2}$/) || 
        !endDate || !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD' });
    }
    
    const { rows: availability } = await pool.query(`
      SELECT 
        date,
        is_available,
        reason,
        notes
      FROM calendar_availability
      WHERE date BETWEEN $1 AND $2
      ORDER BY date
    `, [startDate, endDate]);
    
    res.json({
      success: true,
      data: availability
    });
  } catch (error) {
    console.error('Error checking calendar availability range:', error);
    res.status(500).json({
      message: 'Error checking calendar availability range',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
