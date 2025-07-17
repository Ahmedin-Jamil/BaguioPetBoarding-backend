/**
 * Authentication middleware
 * Verifies JWT tokens and attaches user information to request
 */
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'baguio-pet-hotel-secret-key';

/**
 * Verify JWT token middleware
 * Use this for routes that require authentication
 */
function verifyToken(req, res, next) {
  // Get auth header
  const authHeader = req.headers.authorization;
  
  // Check if auth header exists
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }
  
  // Token format: "Bearer [token]"
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid token format.'
    });
  }
  
  try {
    // Verify token
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Authorization failed'
    });
  }
}

/**
 * Admin role check middleware
 * Use this for routes that require admin access
 */
function isAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
}

/**
 * Optional auth middleware
 * Verifies token if present but doesn't require it
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next();
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }
  
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    next();
  }
}

/**
 * Generate JWT token
 * @param {Object} payload - Data to be encoded in the token
 * @returns {String} JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: process.env.JWT_EXPIRATION || '24h' 
  });
}

module.exports = {
  verifyToken,
  isAdmin,
  optionalAuth,
  generateToken
};
