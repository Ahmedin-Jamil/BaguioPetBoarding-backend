const express = require('express');
const router = express.Router();

// In-memory store for unavailable slots (replace with DB for persistence)
let unavailableSlots = [];

// GET all unavailable slots
router.get('/', (req, res) => {
  res.json(unavailableSlots);
});

// POST a new unavailable slot
router.post('/', (req, res) => {
  const { start, end } = req.body;
  if (!start || !end) return res.status(400).json({ error: 'Missing start or end' });
  unavailableSlots.push({ start, end });
  res.status(201).json({ success: true });
});

// DELETE an unavailable slot
router.delete('/', (req, res) => {
  const { start, end } = req.body;
  unavailableSlots = unavailableSlots.filter(slot =>
    !(slot.start === start && slot.end === end)
  );
  res.json({ success: true });
});

module.exports = router;
