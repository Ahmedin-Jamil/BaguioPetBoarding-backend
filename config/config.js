const config = {
  development: {
    port: process.env.PORT || 3001,
    database: {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pet_hotel',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: false
    },
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
      jwtExpiration: '24h',
      bcryptRounds: 10
    }
  },
  production: {
    port: process.env.PORT || 3001,
    database: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      ssl: {
        rejectUnauthorized: false
      }
    },
    cors: {
      origin: ['https://baguio-pet-boarding.com', 'https://www.baguio-pet-boarding.com', 'http://localhost:3002'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    security: {
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiration: '12h',
      bcryptRounds: 12
    }
  }
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env];
