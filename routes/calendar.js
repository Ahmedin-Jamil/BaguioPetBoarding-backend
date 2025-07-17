const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
require('dotenv').config();
const { validate, validateQuery, schemas, commonValidations } = require('../middleware/validation');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Mark date as unavailable (admin)
router.post('/unavailable', verifyToken, isAdmin, validate(commonValidations.calendarAvailability), async (req, res) => {
  try {
    const { date, reason, notes, adminId } = req.body;
    
    if (!date) {
      return res.status(400).json({
      success: false,
      message: 'Date is required' });
    }
    
    // Validate date format
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
      success: false,
      message: 'Invalid date format. Please use YYYY-MM-DD' });
    }
    
    await pool.query(`
      INSERT INTO calendar_availability (date, is_available, reason, notes, updated_by)
      VALUES ($1, FALSE, $2, $3, $4)
      ON CONFLICT (date) DO UPDATE SET
        is_available = FALSE,
        reason = EXCLUDED.reason,
        notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `, [date, reason || null, notes || null, adminId || null]);
    
    res.status(201).json({
      success: true,
      message: 'Date marked as unavailable successfully',
      date,
      isAvailable: false
    });
  } catch (error) {
    console.error('Error marking date as unavailable:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking date as unavailable',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Mark date as available (admin)
router.post('/available', verifyToken, isAdmin, validate(commonValidations.calendarAvailability), async (req, res) => {
  try {
    const { date, adminId } = req.body;
    
    if (!date) {
      return res.status(400).json({
      success: false,
      message: 'Date is required' });
    }
    
    // Validate date format
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
      success: false,
      message: 'Invalid date format. Please use YYYY-MM-DD' });
    }
    
    await pool.query(`
      INSERT INTO calendar_availability (date, is_available, reason, notes, updated_by)
      VALUES ($1, TRUE, NULL, NULL, $2)
      ON CONFLICT (date) DO UPDATE SET
        is_available = TRUE,
        reason = NULL,
        notes = NULL,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `, [date, adminId || null]);
    
    res.status(200).json({
      success: true,
      message: 'Date marked as available successfully',
      date,
      isAvailable: true
    });
  } catch (error) {
    console.error('Error marking date as available:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking date as available',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get calendar availability for a date range
router.get('/', validateQuery(schemas.dateRange), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
      success: false,
      message: 'Start date and end date are required' });
    }
    
    // Validate date format
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/) || !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
      success: false,
      message: 'Invalid date format. Please use YYYY-MM-DD' });
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
    console.error('Error fetching calendar availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching calendar availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/calendar/unavailable
router.post('/unavailable', async (req, res) => {
  const { date, reason } = req.body;
  if (!date) {
    return res.status(400).json({ success: false, message: 'Date is required.' });
  }
  // Add date format validation
  if (!date.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)) {
    return res.status(400).json({ success: false, message: 'Invalid date format. Please use YYYY-MM-DD' });
  }
  try {
    await pool.query(
      'INSERT INTO calendar_availability (date, is_available, reason) VALUES ($1, FALSE, $2)',
      [date, reason || null]
    );
    res.json({ success: true, message: 'Date marked as unavailable.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error marking date unavailable', error: error.message });
  }
});

module.exports = router;
