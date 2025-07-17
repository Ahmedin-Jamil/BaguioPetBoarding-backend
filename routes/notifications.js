/**
 * Notification Routes
 * Handles notifications for users and admins
 */
const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validation');
const emailService = require('../services/emailService');
const { body } = require('express-validator');

// Schema for validating admin notification requests
const adminNotificationValidation = [
  body('subject').isString().notEmpty().withMessage('Subject is required'),
  body('message').isString().notEmpty().withMessage('Message is required')
];

/**
 * Send notification to admins
 * Public endpoint for sending admin notifications
 */
router.post('/admin-notification', validate(adminNotificationValidation), async (req, res) => {
  try {
    const { subject, message } = req.body;
    
    // Validate required fields
    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required'
      });
    }
    
    // Send admin notification email
    await emailService.sendAdminNotification({
      subject,
      message
    });
    
    res.json({
      success: true,
      message: 'Admin notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending admin notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending admin notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Send email to user - can be used for various notification types
 */
router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    
    if (!to || !subject || !text) {
      return res.status(400).json({
        success: false,
        message: 'Email recipient, subject, and content are required'
      });
    }
    
    // Use the emailService to send the email
    const info = await emailService.sendAdminNotification({
      subject,
      message: text,
      customRecipient: to
    });
    
    res.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending email',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
