const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Debug: Print all environment variables (redacted passwords)
const envVars = {};
Object.keys(process.env).forEach(key => {
  if (key.includes('PASSWORD')) {
    envVars[key] = '******';
  } else {
    envVars[key] = process.env[key];
  }
});
console.log('Available environment variables:', envVars);

// Log environment variables (without sensitive data)
console.log('Database configuration:', {
  host: process.env.PGHOST || process.env.SUPABASE_HOST || process.env.DB_HOST,
  port: process.env.PGPORT || process.env.SUPABASE_PORT || process.env.DB_PORT,
  user: process.env.PGUSER || process.env.SUPABASE_USER || process.env.DB_USER,
  database: process.env.PGDATABASE || process.env.SUPABASE_DATABASE || process.env.DB_DATABASE,
  ssl: true
});

// Revert to using individual parameters instead of connection string
/*const connectionString = `postgresql://${process.env.PGUSER || process.env.SUPABASE_USER}:${process.env.PGPASSWORD || process.env.SUPABASE_PASSWORD}@${process.env.PGHOST || process.env.SUPABASE_HOST}:${process.env.PGPORT || process.env.SUPABASE_PORT}/${process.env.PGDATABASE || process.env.SUPABASE_DATABASE}`;*/

// console.log('Connection string format (password redacted):', connectionString.replace(/:[^:@]+@/, ':******@'));

// Direct connection string for Supabase
const connectionString = 'postgres://postgres.nhylzkcpdxznpwkutxjs:knT4PycppFqg54BN@aws-0-us-east-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20, // Increased max pool size
  idleTimeoutMillis: 10000, // Reduced idle timeout to 10 seconds
  connectionTimeoutMillis: 5000, // Faster connection timeout
  allowExitOnIdle: true, // Allow the app to exit when all clients are idle
  keepAlive: true, // Enable TCP keepalive
});

// Add error handler for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't crash the server on connection errors
  // Instead, let the pool handle reconnection
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

// Test query function with better error handling
async function testQuery() {
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query('SELECT NOW()');
    console.log('Database time:', rows[0].now);
    return true;
  } catch (error) {
    console.error('Error in test query:', error);
    return false;
  } finally {
    // Always release the client back to the pool
    if (client) client.release();
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
