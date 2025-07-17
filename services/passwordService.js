/**
 * Password Service
 * Handles password reset functionality and related operations
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const emailService = require('./emailService');
require('dotenv').config();

/**
 * Generate a random token for password reset
 * @returns {string} Random token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Check if a reset token is valid and not expired
 * @param {string} token - Reset token
 * @returns {Promise<Object>} User data if token is valid
 */
async function validateResetToken(token) {
  try {
    // Use prepared statement to prevent SQL injection
    const [results] = await pool.query(
      'SELECT * FROM password_reset_tokens ' +
      'JOIN users ON password_reset_tokens.user_id = users.user_id ' +
      'WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [token]);

    if (results.length === 0) {
      throw new Error('Invalid or expired reset token');
    }

    return {
      userId: results[0].user_id,
      email: results[0].email,
      firstName: results[0].first_name,
      lastName: results[0].last_name
    };
  } catch (error) {
    console.error('Error validating reset token:', error);
    throw error;
  }
}

/**
 * Create a password reset token for a user
 * @param {string} email - User email
 * @param {Object} metadata - Additional metadata like IP and user agent
 * @returns {Promise<Object>} Reset token data
 */
async function createPasswordResetToken(email, metadata = {}) {
  try {
    // Start transaction
    await pool.query('BEGIN');
    
    // Find user by email using a prepared statement to prevent SQL injection
    const { rows: users } = await pool.query(
      'SELECT user_id, first_name, last_name FROM users WHERE email = $1',
      [email]
    );
    
    if (users.length === 0) {
      // We don't want to reveal if email exists in system for security (prevents email enumeration)
      // Still return success to maintain consistent timing and prevent information disclosure
      // Add a small delay to simulate token creation time for additional timing attack protection
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));
      return { success: true };
    }
    
    const user = users[0];
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
    
    // Delete any existing reset tokens for this user
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [user.id]
    );
    
    // Create new reset token with IP address and user agent for security audit
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user.id, token, expiresAt, metadata.ipAddress || null, metadata.userAgent || null]
    );
    
    // Commit transaction
    await pool.query('COMMIT');
    
    // Return token info
    return {
      success: true,
      token,
      userId: user.user_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email
    };
  } catch (error) {
    // If an error occurred, rollback the transaction
    await pool.query('ROLLBACK');
    console.error('Error creating password reset token:', error);
    throw error;
  } finally {
    // Release the connection
    connection.release();
  }
}

/**
 * Send password reset email
 * @param {Object} data - Reset token data
 * @returns {Promise<Object>} Email send result
 */
async function sendPasswordResetEmail(data) {
  try {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${data.token}`;
    
    const mailOptions = {
      from: `"Baguio Pet Boarding" <${process.env.EMAIL_USER || 'noreply@baguiopetboarding.com'}>`,
      to: data.email,
      subject: 'Password Reset - Baguio Pet Boarding',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <div style="text-align: center; background-color: #4CAF50; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h1>Password Reset</h1>
          </div>
          
          <div style="padding: 20px;">
            <p>Dear ${data.firstName} ${data.lastName},</p>
            
            <p>We received a request to reset your password for your Baguio Pet Boarding account. To reset your password, click the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            
            <p>If the button above doesn't work, you can also copy and paste the following link into your browser:</p>
            <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">${resetLink}</p>
            
            <p>This password reset link will expire in 1 hour.</p>
            
            <p>If you did not request a password reset, you can safely ignore this email. Someone may have entered your email address by mistake.</p>
            
            <p>Thank you,<br>The Baguio Pet Boarding Team</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px;">
            <p>&copy; ${new Date().getFullYear()} Baguio Pet Boarding. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    const info = await emailService.transporter.sendMail(mailOptions);
    console.log(`Password reset email sent: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

/**
 * Reset user password with token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @param {Object} metadata - Additional metadata like IP and user agent
 * @returns {Promise<Object>} Result
 */
async function resetPassword(token, newPassword, metadata = {}) {
  try {
    // Start transaction
    await pool.query('BEGIN');
    
    // Validate reset token and get user - using prepared statement for security
    const { rows: tokens } = await pool.query(
      'SELECT * FROM password_reset_tokens ' +
      'WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [token]
    );
    
    if (tokens.length === 0) {
      throw new Error('Invalid or expired reset token');
    }
    
    const userId = tokens[0].user_id;
    
    // Hash new password (increased to 12 rounds for enhanced security)
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update user password and record the update time
    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );
    
    // Log the password reset with enhanced security tracking
    await pool.query(
      'INSERT INTO audit_log (user_id, action, description, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, 'password_reset', 'Password reset with token', metadata.ipAddress || null, metadata.userAgent || null]
    );
    
    // Delete used token
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE token = $1',
      [token]
    );
    
    // Commit transaction
    await pool.query('COMMIT');
    
    return { success: true };
  } catch (error) {
    // If an error occurred, rollback the transaction
    await pool.query('ROLLBACK');
    console.error('Error resetting password:', error);
    throw error;
  } finally {
    // Release the connection
    connection.release();
  }
}

module.exports = {
  createPasswordResetToken,
  validateResetToken,
  resetPassword,
  sendPasswordResetEmail
};
