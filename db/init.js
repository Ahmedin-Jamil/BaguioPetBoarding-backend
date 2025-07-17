const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

async function initializeDatabase() {
  let connection;
  
  try {
    console.log('\n-------------------------------------');
    console.log('🔄 DATABASE INITIALIZATION STARTED');
    console.log('-------------------------------------');
    
    // Connect without database name first
    console.log('👉 Connecting to MySQL server...');
    connection = await mysql.createConnection(dbConfig);
    
    // Get schema file content
    const schemaFilePath = path.join(__dirname, '../schema.sql');
    const schemaSql = fs.readFileSync(schemaFilePath, 'utf8');
    
    // Drop existing database if it exists and create a new one
    console.log('👉 Recreating database...');
    await connection.query('DROP DATABASE IF EXISTS pet_hotel');
    await connection.query('CREATE DATABASE pet_hotel');
    
    // Close the connection and reopen with the correct database
    await connection.end();
    
    // Reconnect with database selected
    const dbConfigWithDb = {
      ...dbConfig,
      database: 'pet_hotel'
    };
    
    connection = await mysql.createConnection(dbConfigWithDb);
    
    // Execute the schema SQL
    console.log('👉 Creating tables and inserting initial data...');
    await connection.query(schemaSql);
    
    console.log('\n✅ DATABASE INITIALIZATION COMPLETED SUCCESSFULLY!');
    console.log('-------------------------------------\n');
    
  } catch (error) {
    console.error('\n❌ ERROR INITIALIZING DATABASE:', error);
    console.error('-------------------------------------\n');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if called directly (node db/init.js)
if (require.main === module) {
  initializeDatabase().catch(console.error);
}

module.exports = { initializeDatabase };