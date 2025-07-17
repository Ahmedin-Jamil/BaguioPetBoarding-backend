const express = require('express');
const router = express.Router();
const { pool } = require('../config/db'); // Standardize DB connection

// POST /api/users/find - Find user by email or phone (validation removed)
router.post('/find', async (req, res) => {
  const { email, phone } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 OR phone = $2 LIMIT 1', [email || null, phone || null]);
    if (rows.length > 0) {
      return res.json(rows[0]);
    } else {
      return res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST /api/users - Create a new user (validation removed)
router.post('/', async (req, res) => {
  // Accepts { name, phone, email, address } from frontend
  let { name, phone, email, address } = req.body;

  // Split name into first_name and last_name (if possible)
  let first_name = name;
  let last_name = ''; // Default to empty string
  if (name && name.includes(' ')) {
    const parts = name.split(' ');
    first_name = parts.shift();
    last_name = parts.join(' ');
  }

  try {
    const { rows: [result] } = await pool.query(
      'INSERT INTO users (first_name, last_name, email, phone, address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [first_name, last_name, email, phone, address || null]
    );
    return res.json({ id: result.user_id, first_name, last_name, email, phone, address });
  } catch (err) {
    console.error('User creation error:', err);
    res.status(500).json({
      message: 'Server error',
      error: err.sqlMessage || err.message || err,
      stack: err.stack || null,
      full: err
    });
  }
});

module.exports = router;
