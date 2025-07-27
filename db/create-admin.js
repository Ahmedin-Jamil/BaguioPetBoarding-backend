const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

async function createAdmin() {
  const pool = new Pool({
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

  try {
    // Allow username and password via command-line args
    const [, , usernameArg, passwordArg] = process.argv;
    const username = usernameArg || 'baguiopethotel_admin';
    const password = passwordArg || 'BPH@dm1n2025!';

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if admin already exists
    const { rows: existingAdmin } = await pool.query(
      'SELECT * FROM admin WHERE username = $1',
      [username]
    );

    if (existingAdmin.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Create admin user
    await pool.query(
      `INSERT INTO admin (username, password, created_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [username, hashedPassword]
    );

    console.log('Admin user created successfully');
    console.log('Username:', username);
    console.log('Password:', password);
    console.log('Please change this password after first login');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await pool.end();
  }
}

createAdmin().catch(console.error);
