const { Pool } = require('pg');
require('dotenv').config();

/**
 * Initialize PostgreSQL database schema
 */
async function initializeDatabase() {
  let client;
  try {
    console.log('👉 Connecting to PostgreSQL server...');
    
    // Create a client to connect to the default database first
    client = new Pool({
      host: process.env.SUPABASE_HOST,
      port: process.env.SUPABASE_PORT,
      user: process.env.SUPABASE_USER,
      password: process.env.SUPABASE_PASSWORD,
      database: process.env.SUPABASE_DATABASE,
      ssl: {
        rejectUnauthorized: false,
        sslmode: 'require'
      }
    });

    // Connect and create tables
    await client.connect();
    console.log('✅ Connected to PostgreSQL server');

    // Drop and recreate Admin table
    console.log('👉 Dropping admin table...');
    await client.query('DROP TABLE IF EXISTS admin CASCADE;');
    
    console.log('👉 Creating admin table...');
    await client.query(`
      CREATE TABLE admin (
        admin_id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Admin table created');

    // Drop and recreate Guests table
    console.log('👉 Dropping guests table...');
    await client.query('DROP TABLE IF EXISTS guests CASCADE;');
    
    console.log('👉 Creating guests table...');
    await client.query(`
      CREATE TABLE guests (
        guest_id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20) NOT NULL,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');

    // Create Services table
    console.log('👉 Creating services table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        service_id SERIAL PRIMARY KEY,
        service_name VARCHAR(100) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        max_slots INTEGER NOT NULL,
        is_daycare BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Services table created');

    // Create Pets table
    console.log('👉 Creating pets table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS pets (
        pet_id SERIAL PRIMARY KEY,
        guest_id INTEGER REFERENCES guests(guest_id),
        pet_name VARCHAR(100) NOT NULL,
        pet_type VARCHAR(50) NOT NULL,
        breed VARCHAR(100),
        age INTEGER,
        gender VARCHAR(20),
        weight_category VARCHAR(50),
        special_instructions TEXT,
        medical_conditions TEXT,
        emergency_contact VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Pets table created');

    // Create Bookings table
    console.log('👉 Creating bookings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        booking_id SERIAL PRIMARY KEY,
        guest_id INTEGER REFERENCES guests(guest_id),
        pet_id INTEGER REFERENCES pets(pet_id),
        service_id INTEGER REFERENCES services(service_id),
        booking_date DATE NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        special_requests TEXT,
        total_price DECIMAL(10,2),
        reference_number VARCHAR(50) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Bookings table created');

    // Create Calendar table
    console.log('👉 Creating calendar table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar (
        date DATE PRIMARY KEY,
        is_available BOOLEAN DEFAULT true,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Calendar table created');

    // Create Reviews table
    console.log('👉 Creating reviews table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        review_id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(booking_id),
        guest_id INTEGER REFERENCES guests(guest_id),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Reviews table created');

    // Create Notifications table
    console.log('👉 Creating notifications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id SERIAL PRIMARY KEY,
        guest_id INTEGER REFERENCES guests(guest_id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Notifications table created');

    // Create Payments table
    console.log('👉 Creating payments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(booking_id),
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50),
        transaction_id VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Payments table created');

    // Create audit triggers for updated_at
    console.log('👉 Creating update triggers...');
    const tables = ['users', 'services', 'pets', 'bookings', 'calendar', 'reviews', 'notifications', 'payments'];
    for (const table of tables) {
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_${table}()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_${table}();
      `);
    }
    console.log('✅ Update triggers created');

    console.log('✅ Database initialization completed successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the initialization
initializeDatabase().catch(console.error);
