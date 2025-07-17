const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// GET /api/unavailable-dates - Get all unavailable dates (admin blocks and more)
// Uses calendar_availability table where is_available = FALSE
router.get('/', async (req, res) => {
  try {
    // Use unavailable_dates as the source of truth
    const { rows } = await pool.query('SELECT date, reason FROM calendar_availability WHERE is_available = FALSE');
    res.json({ unavailableDates: rows });
  } catch (error) {
    console.error('Error fetching unavailable dates:', error);
    res.status(500).json({ message: 'Failed to fetch unavailable dates' });
  }
});

// POST /api/unavailable-dates - Mark a date as unavailable (admin only)
router.post('/', async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) return res.status(400).json({ message: 'Date is required' });
    await pool.query(
      `INSERT INTO calendar_availability (date, is_available, reason) VALUES ($1, FALSE, $2)
       ON CONFLICT (date) DO UPDATE SET is_available = FALSE, reason = EXCLUDED.reason`,
      [date, reason || null]
    );
    res.status(201).json({ message: 'Date marked as unavailable.' });
  } catch (error) {
    console.error('Error marking date as unavailable:', error);
    res.status(500).json({ message: 'Failed to mark date as unavailable' });
  }
});

// DELETE /api/unavailable-dates/:date - Mark a date as available again (admin only)
router.delete('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    // Validate the date format (optional)
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    await pool.query('UPDATE calendar_availability SET is_available = TRUE, reason = NULL WHERE date = $1', [date]);
    res.json({ success: true, message: 'Date marked as available.' });
  } catch (error) {
    console.error('Error marking date as available:', error);
    res.status(500).json({ message: 'Failed to mark date as available' });
  }
});

module.exports = router;
