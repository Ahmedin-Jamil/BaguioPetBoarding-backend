const { validationResult, body, param, query } = require('express-validator');
const { logger } = require('../config/logger');

// Validation schemas
const schemas = {
  dateParam: [
    param('date')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Invalid date format. Please use YYYY-MM-DD'),
  ],
  
  bookingDate: [
    body('booking_date')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Invalid date format. Please use YYYY-MM-DD'),
  ],
  
  dateRange: [
    query('startDate')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Invalid start date format. Please use YYYY-MM-DD'),
    query('endDate')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Invalid end date format. Please use YYYY-MM-DD'),
  ],
  
  searchQuery: [
    query('email').optional().isEmail().withMessage('Invalid email format'),
    query('booking_id').optional().isInt().withMessage('Invalid booking ID format')
  ],
  
  adminLogin: [
    body('username').isString().trim().notEmpty().withMessage('Username is required'),
    body('password').isString().notEmpty().withMessage('Password is required')
  ],
  userLogin: [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').isString().notEmpty().withMessage('Password is required')
  ],
  forgotPassword: [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address')
  ],
  resetPassword: [
    body('token').isString().notEmpty().withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
  ],
  changePassword: [
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
  ],
};

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({
      type: 'validation_error',
      errors: errors.array(),
      path: req.path
    });
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Common validation rules
const commonValidations = {
  id: param('id').isInt().withMessage('Invalid ID format'),
  
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  
  booking: [
    // Owner information validation
    body('ownerName').isString().trim().notEmpty().withMessage('Owner name is required'),
    body('ownerEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('ownerPhone').matches(/^[0-9+\-\s()]*$/).withMessage('Valid phone number is required'),
    
    // Pet information validation
    body('petName').isString().trim().notEmpty().withMessage('Pet name is required'),
    body('petType').isIn(['Dog', 'Cat']).withMessage('Invalid pet type'),
    body('petBreed').isString().trim().notEmpty().withMessage('Pet breed is required'),
    // Weight category validation removed
    
    // Booking information validation
    body('booking_date').isDate().withMessage('Valid booking date is required'),
    body('end_date').optional().isDate().custom((value, { req }) => {
      if (value && new Date(value) <= new Date(req.body.booking_date)) {
        throw new Error('End date must be after booking date');
      }
      return true;
    }),
    body('service_id').isInt().withMessage('Valid service is required'),
    body('room_type').isString().notEmpty().withMessage('Room type is required'),
    body('special_requests').optional().isString().trim()
  ],
  
  user: [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').optional()
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
    body('firstName').isString().trim().notEmpty().withMessage('First name is required'),
    body('lastName').isString().trim().notEmpty().withMessage('Last name is required'),
    body('phone').matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/).withMessage('Invalid phone number')
  ],
  
  service: [
    body('name').isString().trim().notEmpty().withMessage('Service name is required'),
    body('description').isString().trim().notEmpty().withMessage('Service description is required'),
    body('price').isFloat({ min: 0 }).withMessage('Invalid price'),
    body('duration').isInt({ min: 1 }).withMessage('Invalid duration')
  ],
  
  bookingStatus: [
    body('status')
      .isString()
      .isIn(['pending', 'confirmed', 'completed', 'cancelled'])
      .withMessage('Invalid status value. Must be one of: pending, confirmed, completed, cancelled'),
    body('notes').optional().isString().trim(),
    body('adminId').optional().isInt().withMessage('Invalid admin ID'),
    body('reason').optional().isString().trim()
  ],
  
  calendarAvailability: [
    body('date')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Invalid date format. Please use YYYY-MM-DD'),
    body('reason')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Reason cannot be empty if provided'),
    body('notes')
      .optional()
      .isString()
      .trim(),
    body('adminId')
      .optional()
      .isInt()
      .withMessage('Invalid admin ID')
  ]
};

// Sanitization middleware
const sanitizeBody = (req, res, next) => {
  // Sanitize common fields
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

// Export all validation utilities
module.exports = {
  validateBody: (schema) => {
    const schemaArray = Array.isArray(schema) ? schema : [schema];
    return [...schemaArray, handleValidationErrors];
  },
  validateQuery: (schema) => {
    const schemaArray = Array.isArray(schema) ? schema : [schema];
    return [...schemaArray, handleValidationErrors];
  },
  validateParams: (schema) => {
    const schemaArray = Array.isArray(schema) ? schema : [schema];
    return [...schemaArray, handleValidationErrors];
  },
  schemas,
  commonValidations,
  validate: (schema) => {
    const schemaArray = Array.isArray(schema) ? schema : [schema];
    return [...schemaArray, handleValidationErrors];
  },
  sanitizeBody
};
