const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const compression = require('compression');
const actuator = require('express-actuator');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();
const { createClient } = require('redis');

// Import API Routes
const servicesRoutes = require('./routes/services');
const bookingsRoutes = require('./routes/bookings');
const calendarRoutes = require('./routes/calendar');
const dashboardRoutes = require('./routes/dashboard');
const unavailableDatesRoutes = require('./routes/unavailableDates');
const usersRoutes = require('./routes/users');
const petsRoutes = require('./routes/pets');
const notificationsRoutes = require('./routes/notifications');
const authRoutes = require('./routes/auth');

// Database configuration
// Import database connection and test function
const { pool, testQuery } = require('./db');

console.log('Using Supabase PostgreSQL database connection...');

// Test database connection
testQuery().then(success => {
  if (success) {
    console.log('Database connection test successful');
  } else {
    console.error('Database connection test failed');
  }
});

// Import services
const petApiService = require('./pet_api_service');
const geminiService = require('./gemini_service');

// Initialize Redis Client if not disabled
let redisClient = null;
if (!process.env.REDIS_DISABLED || process.env.REDIS_DISABLED !== 'true') {
  redisClient = createClient({
    // You might need to add connection details here if Redis is not running on localhost:6379
    // url: 'redis://username:password@host:port'
  });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));

  (async () => {
    try {
      await redisClient.connect();
      console.log('Connected to Redis successfully!');
    } catch (err) {
      console.error('Could not connect to Redis:', err);
    }
  })();
} else {
  console.log('Redis is disabled via REDIS_DISABLED environment variable');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS with explicit origins
app.use(cors({
  origin: [
    'https://baguio-pet-boarding.com',
    'https://www.baguio-pet-boarding.com',
    'https://baguiopetboarding-backend.onrender.com',
    'http://localhost:3002',
    'http://localhost:3003'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors({
  origin: [
    'https://baguio-pet-boarding.com',
    'https://www.baguio-pet-boarding.com',
    'https://baguiopetboarding-backend.onrender.com',
    'http://localhost:3002',
    'http://localhost:3003'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Manual CORS header middleware as a backup
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://baguio-pet-boarding.com',
    'https://www.baguio-pet-boarding.com',
    'https://baguiopetboarding-backend.onrender.com',
    'http://localhost:3002',
    'http://localhost:3003'
  ];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // For development and debugging, log unrecognized origins
    console.log('Unrecognized origin:', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path
  });
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Health check endpoint for Render
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy' });
});

// Register API routes
app.use('/api/services', servicesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/unavailable-dates', unavailableDatesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/pets', petsRoutes);
app.use('/api', notificationsRoutes); // Handle all notification routes including send-email and admin-notification

// --- Room Availability Endpoint for Frontend Compatibility ---
const availabilityController = require('./controllers/availabilityController');
app.get('/api/room-availability', availabilityController.getRoomAvailability);

console.log('Service pricing functionality removed!');

// Import chatbot services
const chatbotService = require('./chatbot_service');
const chatbotServiceMultilingual = require('./chatbot_service_multilingual');

// Add endpoint for chatbot
app.post('/api/chatbot/query', async (req, res) => {
  try {
    const { query, sessionId } = req.body;
    console.log('Received chatbot query:', query, 'Session ID:', sessionId || 'none');
    
    if (!query) {
      console.log('No query provided');
      return res.status(400).json({ 
        answer: "I didn't catch that. Could you please ask a question?",
        success: true 
      });
    }
    
    let botResponse = null;

    // --- First try to use the knowledge base directly ---
    try {
      // Import the chatbot module that handles knowledge base parsing
      const chatbot = require('./chatbot');
      console.log('Using knowledge base for query:', query);
      
      // Process the query using the knowledge base
      const knowledgeBaseResponse = await chatbot.processQuery(query, sessionId);
      
      if (knowledgeBaseResponse && knowledgeBaseResponse.answer) {
        console.log('Found answer in knowledge base');
        botResponse = knowledgeBaseResponse;
        
        // Return the knowledge base response immediately
        console.log('Sending knowledge base response:', botResponse);
        return res.json(botResponse);
      } else {
        console.log('No direct match found in knowledge base, continuing to fallbacks');
      }
    } catch (kbError) {
      console.error('Error processing with knowledge base:', kbError);
      // Continue to fallbacks
    }

    // --- Custom handling for 'room options for pets' FAQ ---
    if (!botResponse && query && query.toLowerCase().includes('room options for pets')) {
      // Read the official answer directly from pet_hotel.txt for accuracy
      const fs = require('fs');
      const path = require('path');
      const kbPath = path.join(__dirname, 'knowledge_base', 'pet_hotel.txt');
      try {
        const kbContent = fs.readFileSync(kbPath, 'utf8');
        // Extract the room options answer
        const lines = kbContent.split('\n');
        const startIdx = lines.findIndex(l => l.includes('What are your room options for pets?'));
        if (startIdx !== -1) {
          let answerLines = [];
          for (let i = startIdx + 1; i < lines.length; i++) {
            if (lines[i].trim().startsWith('What')) break; // Next question
            answerLines.push(lines[i]);
          }
          const answer = answerLines.join('\n').trim();
          botResponse = {
            answer,
            success: true
          };
          console.log('Sent official room options answer from knowledge base.');
          return res.json(botResponse);
        }
      } catch (e) {
        console.error('Failed to read pet_hotel.txt for room options:', e);
      }
    }
    // --- End custom handling ---

    // If knowledge base didn't have an answer, try rule-based chatbot service
    if (!botResponse) {
      console.log('Using rule-based chatbot service');
      try {
        const chatbotResponse = await chatbotService.processQuery(query);
        if (chatbotResponse && chatbotResponse.answer) {
          botResponse = chatbotResponse;
          console.log('Got response from rule-based chatbot');
          return res.json(botResponse);
        }
      } catch (chatbotError) {
        console.error('Error with rule-based chatbot:', chatbotError);
      }
    }
    
    // Only use Gemini AI as a last resort if explicitly enabled
    if (!botResponse && process.env.GEMINI_API_KEY && process.env.USE_GEMINI_FALLBACK === 'true') {
      try {
        console.log('Attempting to use Gemini AI as last resort...');
        const geminiResponse = await geminiService.generateContent(
          `You are a helpful assistant for a pet hotel that provides boarding and grooming services.
          IMPORTANT: Limit your response to a MAXIMUM of 80 words. Keep it concise and helpful.
          ONLY answer if you are certain the information is accurate for Baguio Pet Boarding.
          If you're not sure, respond with "I don't have specific information about that in my knowledge base."
          Answer the following query about pet boarding, pet care, or pet grooming: ${query}`
        );
        
        if (geminiResponse.status === 'success' && geminiResponse.text) {
          console.log('Gemini response successful');
          
          // Enforce 80-word limit by counting and truncating
          let responseText = geminiResponse.text;
          const words = responseText.split(/\s+/);
          
          if (words.length > 80) {
            console.log(`Truncating response from ${words.length} words to 80 words`);
            responseText = words.slice(0, 80).join(' ');
            // Add ellipsis if not ending with punctuation
            if (!responseText.match(/[.!?]$/)) {
              responseText += '...';
            }
          }
          
          botResponse = {
            answer: responseText,
            success: true
          };
        }
      } catch (geminiError) {
        console.error('Error with Gemini service:', geminiError);
      }
    }
    
    // If everything failed, use a default response
    if (!botResponse) {
      botResponse = {
        answer: "I can help with questions about our pet boarding, grooming, and daycare services. What would you like to know?",
        success: true
      };
    }
    
    // Send the response
    console.log('Sending chatbot response:', botResponse);
    return res.json(botResponse);
    
  } catch (error) {
    console.error('Error processing chatbot query:', error);
    return res.status(200).json({
      answer: "I'm having trouble processing your request. Please try asking about our pet boarding or grooming services.",
      success: true
    });
  }
});

// Add endpoint for multilingual chatbot
app.post('/api/chatbot/query/multilingual', async (req, res) => {
  try {
    const { query, language } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`Processing multilingual query in ${language || 'en'} language:`, query);
    
    // First try to use Gemini AI for more advanced responses
    try {
      let geminiPrompt;
      
      switch (language) {
        case 'tl':
          geminiPrompt = `Ikaw ay isang kapaki-pakinabang na assistant para sa isang pet hotel na nagbibigay ng boarding at grooming services. MAHALAGA: Panatilihin ang iyong sagot sa maximum na 80 salita lamang. Maging malinaw at kapaki-pakinabang. Sagutin ang sumusunod na katanungan tungkol sa pet boarding, pet care, o pet grooming: ${query}`;
          break;
        default: // 'en'
          geminiPrompt = `You are a helpful assistant for a pet hotel that provides boarding and grooming services. IMPORTANT: Keep your response under 80 words maximum. Be concise and helpful. Answer the following query about pet boarding, pet care, or pet grooming: ${query}`;
          break;
      }
      
      const geminiResponse = await geminiService.generateContent(geminiPrompt);
      
      if (geminiResponse.status === 'success') {
        console.log(`Successfully generated response with Gemini AI in ${language || 'en'}`);
        
        // Enforce 80-word limit by counting and truncating
        let responseText = geminiResponse.text;
        const words = responseText.split(/\s+/);
        
        if (words.length > 80) {
          console.log(`Truncating multilingual response from ${words.length} words to 80 words`);
          responseText = words.slice(0, 80).join(' ');
          // Add ellipsis if not ending with punctuation
          if (!responseText.match(/[.!?]$/)) {
            responseText += '...';
          }
        }
        
        return res.json({
          answer: responseText,
          sources: []
        });
      }
      
      // If Gemini returned a specific error message, use it instead of falling back
      if (geminiResponse.text && geminiResponse.text !== '') {
        console.log(`Using Gemini error message as response for ${language || 'en'} query`);
        return res.json({
          answer: geminiResponse.text,
          sources: []
        });
      }
      
      // If Gemini fails, log the error and fall back to the rule-based chatbot
      console.log(`Falling back to rule-based chatbot due to Gemini error in ${language || 'en'}:`, geminiResponse.error);
    } catch (geminiError) {
      console.error(`Error with Gemini service for ${language || 'en'} query:`, geminiError);
      // Continue to fallback
    }
    
    // Process the query using the multilingual service as fallback
    const response = await chatbotServiceMultilingual.processQuery(query, language);
    res.json(response);
  } catch (error) {
    console.error('Error processing multilingual chatbot query:', error);
    
    // Provide language-specific error messages
    let errorMessage;
    switch (req.body.language) {
      case 'tl':
        errorMessage = "Nagkakaproblema ako sa pagkonekta sa aking knowledge base ngayon. Pakisubukang muli mamaya o direktang makipag-ugnayan sa aming staff para sa tulong.";
        break;
      default: // 'en'
        errorMessage = "I'm having trouble connecting to my knowledge base right now. Please try again later or contact our staff directly for assistance.";
        break;
    }
    
    res.status(500).json({
      answer: errorMessage,
      sources: []
    });
  }
});

// Import test function from db.js
// Test database connection
testQuery().then(success => {
  if (success) {
    console.log('Database connection test successful');
  } else {
    console.error('Database connection test failed');
  }
});

// Verify database connection on startup
pool.connect().then(client => {
  console.log('Successfully connected to Supabase PostgreSQL database');
  client.release();
}).catch(error => {
  console.error('Error connecting to database:', error);
  console.log('Database connection details (without password):');
  console.log('- Host:', process.env.SUPABASE_HOST);
  console.log('- User:', process.env.SUPABASE_USER);
  console.log('- Database:', process.env.SUPABASE_DATABASE);
  console.log('- Port:', process.env.SUPABASE_PORT || '6543');
  console.log('Continuing without database connection...');
});

// Helper function to ensure required tables exist
const ensureRequiredTables = async () => {
  try {
    // Create unavailable_dates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS unavailable_dates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        reason TEXT,
        service_type VARCHAR(50) DEFAULT 'all',
        room_type VARCHAR(50) DEFAULT 'all',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_date_service_room (date, service_type, room_type)
      );
    `);
    console.log('Unavailable dates table verified');

    // Create availability_tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS availability_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        service_type VARCHAR(50) NOT NULL,
        room_type VARCHAR(50) NOT NULL,
        total_slots INT NOT NULL DEFAULT 10,
        booked_slots INT NOT NULL DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY date_service_room (date, service_type, room_type)
      )
    `);
    console.log('Availability tracking table verified');
    return true;
  } catch (error) {
    console.error('Error ensuring availability tracking table:', error);
    return false;
  }
};

// Calculate available slots based on bookings in the database
const calculateAvailableSlotsForDate = async (date, serviceType, roomType) => {
  try {
    // Format date consistently (YYYY-MM-DD)
    const formattedDate = new Date(date).toISOString().split('T')[0];
    
    // Get total capacity based on service/room type
    let totalSlots = 10; // Default capacity for daycare
    if (serviceType === 'overnight') {
      if (roomType === 'executive room') {
        totalSlots = 2;
      } else {
        totalSlots = 10; // Default for deluxe and premium rooms
      }
    } else if (serviceType === 'grooming') {
      if (roomType === 'Premium Grooming' || roomType === 'Special Grooming Package') {
        totalSlots = 5;
      } else {
        totalSlots = 10; // Basic Bath & Dry
      }
    }
    
    // Query to count bookings for this date, service type, and room type
    const countQuery = `
      SELECT COUNT(*) as bookedSlots
      FROM bookings
      WHERE 
        DATE(start_date) <= ? AND DATE(IFNULL(end_date, start_date)) >= ? 
        AND service_type = ? 
        AND (room_type = ? OR (? = 'daycare' AND service_type = 'daycare'))
        AND status NOT IN ('cancelled', 'cancel')
    `;
    
    const [rows] = await pool.query(countQuery, [formattedDate, formattedDate, serviceType, roomType, serviceType]);
    const bookedSlots = rows[0]?.bookedSlots || 0;
    
    // Check if date is marked unavailable
    const [unavailableDates] = await pool.query(
      `SELECT * FROM unavailable_dates 
       WHERE date = ? AND (service_type = ? OR service_type = 'all') 
       AND (room_type = ? OR room_type = 'all')`,
      [formattedDate, serviceType, roomType]
    );
    
    // If date is unavailable, return 0 slots
    if (unavailableDates.length > 0) {
      console.log(`Date ${formattedDate} is marked as unavailable for ${serviceType}/${roomType}`);
      return 0;
    }
    
    // Calculate available slots
    const availableSlots = Math.max(0, totalSlots - bookedSlots);
    console.log(`Available slots for ${serviceType}/${roomType} on ${formattedDate}: ${availableSlots} (Total: ${totalSlots}, Booked: ${bookedSlots})`);
    
    // Update the availability tracking table
    await ensureRequiredTables();
    await pool.query(`
      INSERT INTO availability_tracking (date, service_type, room_type, total_slots, booked_slots)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        total_slots = VALUES(total_slots),
        booked_slots = VALUES(booked_slots)
    `, [formattedDate, serviceType, roomType, totalSlots, bookedSlots]);
    
    return availableSlots;
  } catch (error) {
    console.error(`Error calculating available slots for ${date}, ${serviceType}, ${roomType}:`, error);
    return 10; // Default fallback value
  }
};

// API endpoint to get daycare availability for today
app.get('/api/availability/daycare/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const availableSlots = await calculateAvailableSlotsForDate(today, 'daycare', 'daycare');
    
    res.json({
      date: today,
      serviceType: 'daycare',
      availableSlots,
      success: true
    });
  } catch (error) {
    console.error('Error fetching daycare availability for today:', error);
    res.status(500).json({ 
      message: 'Error fetching availability', 
      error: error.message,
      availableSlots: 10, // Default fallback value
      success: false
    });
  }
});

// API endpoint to get daycare availability for a specific date
app.get('/api/availability/daycare/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // If not in YYYY-MM-DD format, try to parse and convert
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ 
          message: 'Invalid date format. Please use YYYY-MM-DD', 
          success: false 
        });
      }
      // Convert to YYYY-MM-DD format
      const formattedDate = parsedDate.toISOString().split('T')[0];
      // Redirect to the proper URL format
      return res.redirect(`/api/availability/daycare/${formattedDate}`);
    }
    
    const availableSlots = await calculateAvailableSlotsForDate(date, 'daycare', 'daycare');
    
    res.json({
      date,
      serviceType: 'daycare',
      availableSlots,
      success: true
    });
  } catch (error) {
    console.error(`Error fetching daycare availability for date ${req.params.date}:`, error);
    res.status(500).json({ 
      message: 'Error fetching availability', 
      error: error.message,
      availableSlots: 10, // Default fallback value
      success: false
    });
  }
});

// Generic endpoint to check availability for any room type and date
app.get('/api/availability/:roomType/:date', async (req, res) => {
  try {
    const { roomType, date } = req.params;
    
    // Determine service type based on room type
    let serviceType;
    if (roomType === 'daycare') {
      serviceType = 'daycare';
    } else if (['deluxe room', 'premium room', 'executive room'].includes(roomType)) {
      serviceType = 'overnight';
    } else if (['Premium Grooming', 'Basic Bath & Dry', 'Special Grooming Package'].includes(roomType)) {
      serviceType = 'grooming';
    } else {
      return res.status(400).json({ 
        message: 'Invalid room type', 
        success: false 
      });
    }
    
    // Validate date format
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Try to parse and convert
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ 
          message: 'Invalid date format. Please use YYYY-MM-DD', 
          success: false 
        });
      }
    }
    
    const availableSlots = await calculateAvailableSlotsForDate(date, serviceType, roomType);
    
    res.json({
      date,
      roomType,
      serviceType,
      availableSlots,
      success: true
    });
  } catch (error) {
    console.error(`Error fetching availability for ${req.params.roomType} on ${req.params.date}:`, error);
    res.status(500).json({ 
      message: 'Error fetching availability', 
      error: error.message,
      availableSlots: 10, // Default fallback value
      success: false
    });
  }
});

// Calendar availability toggle endpoint
app.post('/api/calendar/availability/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Check if date already exists in unavailable_dates
    const [existing] = await pool.query(
      'SELECT * FROM unavailable_dates WHERE date = ?',
      [date]
    );
    
    if (existing.length > 0) {
      // Date is currently unavailable, make it available by deleting
      await pool.query(
        'DELETE FROM unavailable_dates WHERE date = ?',
        [date]
      );
      res.json({ message: 'Date is now available', available: true });
    } else {
      // Date is currently available, make it unavailable by adding
      await pool.query(
        'INSERT INTO unavailable_dates (date) VALUES (?)',
        [date]
      );
      res.json({ message: 'Date is now unavailable', available: false });
    }
  } catch (error) {
    console.error('Error toggling date availability:', error);
    res.status(500).json({ message: 'Error updating availability' });
  }
});

// Routes
app.get('/', (req, res) => {
  res.send('Pet Hotel API is running');
});

// Pet API Routes
// Get dog breeds
app.get('/api/pets/dogs', async (req, res) => {
  try {
    const dogBreeds = await petApiService.getDogBreeds();
    res.json(dogBreeds);
  } catch (error) {
    console.error('Error fetching dog breeds:', error);
    res.status(500).json({ error: 'Failed to fetch dog breeds' });
  }
});

// Get cat breeds
app.get('/api/pets/cats', async (req, res) => {
  try {
    const { query } = req.query;
    const breeds = await petApiService.getCatBreeds(query);
    res.json(breeds);
  } catch (error) {
    console.error('Error fetching cat breeds:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pet care tips
app.get('/api/pets/care-tips', async (req, res) => {
  try {
    const { petType } = req.query;
    const tips = await petApiService.getPetCareTips(petType);
    res.json(tips);
  } catch (error) {
    console.error('Error fetching pet care tips:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get boarding information
app.get('/api/pets/boarding-info', (req, res) => {
  try {
    const boardingInfo = petApiService.getBoardingInfo();
    res.json(boardingInfo);
  } catch (error) {
    console.error('Error fetching boarding info:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get grooming information
app.get('/api/pets/grooming-info', (req, res) => {
  try {
    const groomingInfo = petApiService.getGroomingInfo();
    res.json(groomingInfo);
  } catch (error) {
    console.error('Error fetching grooming info:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Gemini AI endpoint for advanced AI responses
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt, petType, topic } = req.body;
    
    if (!prompt && !(petType && topic)) {
      return res.status(400).json({ error: 'Either prompt or petType and topic are required' });
    }
    
    let response;
    
    if (prompt) {
      // Direct prompt to Gemini
      response = await geminiService.generateContent(prompt);
    } else if (petType && topic) {
      // Generate pet care advice
      response = await geminiService.generatePetCareAdvice(petType, topic);
    }
    
    if (response.status === 'success') {
      res.json(response);
    } else {
      res.status(500).json({
        text: 'Failed to generate AI response',
        status: 'error',
        error: response.error
      });
    }
  } catch (error) {
    console.error('Error generating AI content:', error);
    res.status(500).json({
      text: 'An error occurred while processing your request',
      status: 'error',
      error: error.message
    });
  }
});

// Email notification endpoints are now handled in notificationsRoutes

app.get('/test', (req, res) => {
  res.send('Test route is working!');
});

// Check availability for specific room type and date range
app.get('/api/check-availability', async (req, res) => {
  try {
    const { roomType, startDate, endDate } = req.query;
    
    if (!roomType || !startDate || !endDate) {
      return res.status(400).json({ 
        message: 'Room type, start date, and end date are required' 
      });
    }
    
    // Call the IsRoomAvailable function we created
    const { rows: [result] } = await pool.query(
      'SELECT IsRoomAvailable($1, $2, $3) AS is_available', 
      [roomType, startDate, endDate]
    );
    
    res.json({ 
      roomType, 
      startDate, 
      endDate, 
      isAvailable: result.is_available 
    });
  } catch (error) {
    console.error('Error checking room availability:', error);
    res.status(500).json({ 
      message: 'Error checking room availability', 
      error: error.message 
    });
  }
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Baguio Pet Boarding API',
      version: '1.0.0',
      description: 'API documentation for Baguio Pet Boarding system'
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      }
    ]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Apply compression middleware
app.use(compression());

// Health check endpoints
app.use(actuator());

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint for Render
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Redis cache middleware
const cacheMiddleware = async (req, res, next) => {
  if (!redisClient || req.method !== 'GET') return next();
  
  try {
    const key = `cache:${req.originalUrl}`;
    const cachedResponse = await redisClient.get(key);
    
    if (cachedResponse) {
      return res.json(JSON.parse(cachedResponse));
    }
    
    res.sendResponse = res.json;
    res.json = async (body) => {
      await redisClient.setex(key, 300, JSON.stringify(body)); // Cache for 5 minutes
      res.sendResponse(body);
    };
    
    next();
  } catch (error) {
    console.error('Cache middleware error:', error);
    next();
  }
};

// Apply caching to specific routes
app.use('/api/services', cacheMiddleware);
app.use('/api/pets', cacheMiddleware);

// Start server with the PORT environment variable (critical for Render deployment)
const startServer = () => {
  const serverPort = parseInt(PORT, 10);
  
  // Start server first to avoid Render timeout
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${serverPort}`);
  });

  // Add error handler for server
  server.on('error', (error) => {
    console.error('Server error:', error);
  });

  // Add keep-alive settings
  server.keepAliveTimeout = 65000; // Slightly higher than 60 seconds
  server.headersTimeout = 66000; // Slightly higher than keepAliveTimeout
  console.log(`API URL: http://localhost:${serverPort}`);
};

// Start the server
startServer();

// Global error logger
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

module.exports = app;