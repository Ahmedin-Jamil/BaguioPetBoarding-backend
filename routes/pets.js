const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// POST /api/pets/find - Find pet by name, type, and user_id
router.post('/find', async (req, res) => {
  // Accepts { name, type, user_id } from frontend
  const { name, type, user_id } = req.body;
  if (!name || !type || !user_id) {
    return res.status(400).json({ message: 'Pet name, type, and user_id are required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM pets WHERE pet_name = $1 AND pet_type = $2 AND user_id = $3 LIMIT 1',
      [name, type, user_id]
    );
    if (rows.length > 0) {
      return res.json(rows[0]);
    } else {
      return res.status(404).json({ message: 'Pet not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});


// POST /api/pets - Create a new pet
router.post('/', async (req, res) => {
  // Accepts { user_id, name, type, breed, age, gender, date_of_birth, weight_category, special_instructions, medical_conditions, emergency_contact } from frontend
  const { user_id, name, type, breed, age, gender, date_of_birth, weight_category, special_instructions, medical_conditions, emergency_contact } = req.body;
  if (!user_id || !name || !type) {
    return res.status(400).json({ message: 'user_id, name, and type are required' });
  }
  
  try {
    const { rows: [result] } = await pool.query(
      'INSERT INTO pets (user_id, pet_name, pet_type, breed, special_instructions, medical_conditions, emergency_contact) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [user_id, name, type, breed || '', special_instructions || '', medical_conditions || '', emergency_contact || '']
    );
    return res.json({ 
      id: result.pet_id, 
      user_id, 
      pet_name: name, 
      pet_type: type, 
      breed, 
      age, 
      gender, 
      date_of_birth, 
      weight_category,
      special_instructions, 
      medical_conditions, 
      emergency_contact 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

module.exports = router;
