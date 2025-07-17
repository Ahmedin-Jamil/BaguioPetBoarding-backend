const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: 'Too many login attempts, please try again later.'
});

// Security middleware setup
const securityMiddleware = [
  // Basic security headers
  helmet(),
  
  // Content Security Policy
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.thedogapi.com', 'https://api.thecatapi.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  }),
  
  // Prevent clickjacking
  helmet.frameguard({ action: 'deny' }),
  
  // Disable MIME type sniffing
  helmet.noSniff(),
  
  // Enable XSS filter
  helmet.xssFilter(),
  
  // HSTS (HTTP Strict Transport Security)
  helmet.hsts({
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  })
];

module.exports = {
  limiter,
  authLimiter,
  securityMiddleware
};
