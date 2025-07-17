/**
 * Script to update database schema with password reset tables
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  console.log('Starting password reset schema update...');

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, 'password-reset-schema.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('SQL script loaded successfully');
    
    // Create database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pet_boarding',
      multipleStatements: true // Allow multiple SQL statements
    });
    
    console.log('Connected to database');
    
    // Execute SQL script
    await connection.query(sqlScript);
    console.log('Database schema updated successfully');
    
    // Close connection
    await connection.end();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error updating schema:', error);
    process.exit(1);
  }
}

// Run the main function
main().then(() => {
  console.log('Schema update complete');
}).catch(err => {
  console.error('Failed to update schema:', err);
});
