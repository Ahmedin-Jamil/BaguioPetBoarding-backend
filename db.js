const { Pool } = require('pg');
require('dotenv').config();

// Log environment variables (without sensitive data)
console.log('Database configuration:', {
  host: process.env.SUPABASE_HOST,
  port: process.env.SUPABASE_PORT,
  user: process.env.SUPABASE_USER,
  database: process.env.SUPABASE_DATABASE,
  ssl: true
});

const pool = new Pool({
  host: process.env.SUPABASE_HOST,
  port: parseInt(process.env.SUPABASE_PORT || '5432', 10),
  user: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PASSWORD,
  database: process.env.SUPABASE_DATABASE || 'postgres',
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  },
  max: 10, // Set max pool size
  idleTimeoutMillis: 30000 // Close idle clients after 30 seconds
});

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('Successfully connected to Supabase PostgreSQL database');
    release();
  }
});

// Test query function
async function testQuery() {
  try {
    const { rows } = await pool.query('SELECT NOW()');
    console.log('Database time:', rows[0].now);
    return true;
  } catch (error) {
    console.error('Error in test query:', error);
    return false;
  }
}

// Helper to format a Date or string to YYYY-MM-DD
function formatDateString(date) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Export pool and helpers
module.exports = { pool, testQuery, formatDateString };
