/**
 * Database connection
 * Re-exports the pool from db.js for backwards compatibility
 */

const { pool } = require('./db');

module.exports = pool;
