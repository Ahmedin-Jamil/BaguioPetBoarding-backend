const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applySchema() {
    const pool = new Pool({
        host: process.env.SUPABASE_HOST,
        port: parseInt(process.env.SUPABASE_PORT || '5432'),
        user: process.env.SUPABASE_USER,
        password: process.env.SUPABASE_PASSWORD,
        database: process.env.SUPABASE_DATABASE,
        ssl: {
            rejectUnauthorized: false,
            sslmode: 'require'
        }
    });

    try {
        // Read the schema file
        const schemaPath = path.join(__dirname, 'schema_postgres.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

        console.log('Connecting to database...');
        const client = await pool.connect();

        try {
            console.log('Applying schema...');
            await client.query(schemaSQL);
            console.log('Schema applied successfully!');
        } catch (error) {
            console.error('Error applying schema:', error);
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Database operation failed:', error);
    } finally {
        await pool.end();
    }
}

applySchema();
