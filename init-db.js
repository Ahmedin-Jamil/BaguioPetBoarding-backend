const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  host: 'aws-0-us-east-2.pooler.supabase.com',
  port: 6543,
  user: 'postgres.nhylzkcpdxznpwkutxjs',
  password: 'knT4PycppFqg54BN',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'db', 'init-postgresql.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL file
    console.log('Initializing database...');
    await client.query(sql);
    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initializeDatabase();
