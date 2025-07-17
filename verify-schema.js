const { Pool } = require('pg');
require('dotenv').config();

async function verifySchema() {
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
        console.log('Connecting to database...');
        const client = await pool.connect();

        try {
            // Check service categories
            console.log('\nChecking service categories:');
            const categories = await client.query('SELECT * FROM service_categories');
            console.log(`Found ${categories.rows.length} service categories`);
            console.log(categories.rows);

            // Check services
            console.log('\nChecking services:');
            const services = await client.query('SELECT service_name, service_type, price_small, price_large FROM services');
            console.log(`Found ${services.rows.length} services`);
            console.log(services.rows);

            // Check custom types
            console.log('\nChecking custom ENUM types:');
            const types = await client.query(`
                SELECT t.typname, e.enumlabel
                FROM pg_type t 
                JOIN pg_enum e ON t.oid = e.enumtypid  
                JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'public'
                ORDER BY t.typname, e.enumsortorder;
            `);
            console.log('Custom ENUM types:');
            const enumTypes = {};
            types.rows.forEach(row => {
                if (!enumTypes[row.typname]) {
                    enumTypes[row.typname] = [];
                }
                enumTypes[row.typname].push(row.enumlabel);
            });
            console.log(enumTypes);

        } catch (error) {
            console.error('Error verifying schema:', error);
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

verifySchema();
