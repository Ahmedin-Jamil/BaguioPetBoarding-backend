/**
 * Authentication Routes for Baguio Pet Boarding
 * Handles user login, registration, and password reset
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { validate, schemas } = require('../middleware/validation');
const { verifyToken, generateToken } = require('../middleware/auth');
const passwordService = require('../services/passwordService');
const { pool } = require('../config/db');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/admin/login', validate(schemas.adminLogin), async (req, res) => {
  try {
    console.log('Admin login request body:', req.body);
    const { username, password } = req.body;
    
    // Check if admin exists
    const { rows: [admin] } = await pool.query(
      'SELECT * FROM admin WHERE username = $1',
      [username]
    );
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Create JWT token
    const adminData = {
      admin_id: admin.admin_id,
      username: admin.username,
      role: 'admin'
    };
    
    const token = generateToken(adminData);
    
    res.status(200).json({
      success: true,
      message: 'Admin logged in successfully',
      data: {
        admin_id: admin.admin_id,
        username: admin.username,
        token
      }
    });
    
  } catch (error) {
    console.error('Error logging in admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', validate(schemas.userLogin), async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const { rows: users } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = users[0];
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Create JWT token
    const userData = {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    };
    
    const token = generateToken(userData);
    
    res.json({
      success: true,
      data: {
        user_id: user.user_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        token
      }
    });
    
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   POST /api/auth/admin-register
 * @desc    Register an admin user (protected)
 * @access  Admin only
 */
router.post('/admin-register', verifyToken, async (req, res) => {
  try {
    // This route is for initial admin setup or by super admin
    // In production, this would have stronger restrictions
    const { firstName, lastName, email, password, phone } = req.body;
    
    // For simplicity, we'll check for a special admin registration key
    // In a real app, this would be more secure
    const adminKey = req.headers['x-admin-key'];
    
    if (!adminKey || adminKey !== process.env.ADMIN_REGISTRATION_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized admin registration attempt'
      });
    }
    
    // Check if user exists
    const [existingUser] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Set role to 'admin'
    const role = 'admin';
    
    // Create admin user
    const [result] = await pool.query(
      `INSERT INTO users 
      (first_name, last_name, email, password, phone, role, created_at) 
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *`,
      [firstName, lastName, email, hashedPassword, phone, role]
    );
    
    res.status(201).json({
      success: true,
      message: 'Admin user registered successfully',
      data: {
        user_id: result.id,
        firstName,
        lastName,
        email,
        role
      }
    });
    
  } catch (error) {
    console.error('Error registering admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering admin',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token and return user data
 * @access  Private
 */
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'baguio-pet-hotel-secret-key');
    
    // Get user data from database (without password)
    const [users] = await pool.query(
      'SELECT user_id, first_name, last_name, email, phone, address, role FROM users WHERE user_id = ?',
      [verified.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        user_id: users[0].user_id,
        firstName: users[0].first_name,
        lastName: users[0].last_name,
        email: users[0].email,
        phone: users[0].phone,
        address: users[0].address,
        role: users[0].role
      }
    });
    
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Authentication failed'
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', validate(schemas.forgotPassword), async (req, res) => {
  try {
    const { email } = req.body;
    
    // Capture security metadata
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };
    
    // Generate reset token with security metadata
    const resetData = await passwordService.createPasswordResetToken(email, metadata);
    
    // Send password reset email
    if (resetData.token) {
      await passwordService.sendPasswordResetEmail(resetData);
    }
    
    // Always return success to prevent email enumeration attacks
    res.json({
      success: true,
      message: 'If your email is registered, you will receive password reset instructions.'
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   GET /api/auth/reset-password/:token
 * @desc    Validate reset token
 * @access  Public
 */
router.get('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Validate token
    const userData = await passwordService.validateResetToken(token);
    
    res.json({
      success: true,
      message: 'Valid reset token',
      data: { 
        userId: userData.userId,
        email: userData.email
      }
    });
  } catch (error) {
    console.error('Error validating reset token:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', validate(schemas.resetPassword), async (req, res) => {
  try {
    const { token, password } = req.body;
    
    // Capture security metadata
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };
    
    // Reset user password with security metadata
    await passwordService.resetPassword(token, password, metadata);
    
    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error resetting password'
    });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password (authenticated)
 * @access  Private
 */
router.post('/change-password', verifyToken, validate(schemas.changePassword), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.user_id;
    
    // Get user from database with prepared statement to prevent SQL injection
    const { rows: users } = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const user = users[0];
    
    // Verify current password using bcrypt's secure compare
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      // Use consistent error messages to prevent timing attacks
      return res.status(400).json({ success: false, message: 'Authentication failed' });
    }
    
    // Hash new password with strong bcrypt hash (cost factor 12)
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password using prepared statement
    await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [hashedPassword, userId]);
    
    // Add to audit log with prepared statement
    await pool.query(
      'INSERT INTO audit_log (user_id, action, description, ip_address) VALUES ($1, $2, $3, $4)',
      [userId, 'password_change', 'Password changed by authenticated user', req.ip || 'unknown']
    );
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

module.exports = router;
