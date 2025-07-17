/**
 * Database configuration and connection pool setup
 */

// Import the pool from the main db.js file
const { pool } = require('../db');

// Format date helper function
const formatDateString = (dateString) => {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

// Export the pool and formatDateString for use in other files
module.exports = {
  pool,
  formatDateString
};
