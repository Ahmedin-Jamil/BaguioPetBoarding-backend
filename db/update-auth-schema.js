/**
 * Database Update Script for Authentication Schema
 * Adds user authentication tables and updates existing tables
 */
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function updateAuthSchema() {
  console.log('💾 Starting authentication schema update...');
  
  // Create database connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pet_boarding',
    multipleStatements: true // Important for running multiple SQL statements
  });
  
  try {
    // Read the SQL file
    console.log('📂 Reading authentication schema SQL file...');
    const sqlPath = path.join(__dirname, 'auth-schema-update.sql');
    const sqlScript = await fs.readFile(sqlPath, 'utf8');
    
    // Execute the SQL script
    console.log('🔧 Executing database updates...');
    await connection.query(sqlScript);
    
    console.log('✅ Authentication schema update completed successfully!');
  } catch (error) {
    console.error('❌ Error updating authentication schema:', error);
  } finally {
    // Close the connection
    await connection.end();
  }
}

// Run the update
updateAuthSchema();
