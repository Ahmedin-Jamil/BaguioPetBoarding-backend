/**
 * Email Service for Baguio Pet Boarding
 * Handles sending emails for booking confirmations, status updates, etc.
 */
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

// Admin email for notifications
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@baguiopetboarding.com';

// Helper to resolve recipient info
function resolveRecipient(booking) {
  // Extract all possible email fields
  const emailAddr = booking.guest_user?.email || 
                   booking.user?.email || 
                   booking.owner_email || 
                   booking.ownerEmail || 
                   booking.email;

  // Extract all possible name fields
  const firstName = booking.guest_user?.first_name || 
                   booking.user?.first_name || 
                   booking.owner_first_name || 
                   booking.first_name ||
                   (booking.ownerName ? booking.ownerName.split(' ')[0] : null) ||
                   'Guest';

  const lastName = booking.guest_user?.last_name || 
                  booking.user?.last_name || 
                  booking.owner_last_name || 
                  booking.last_name ||
                  (booking.ownerName ? booking.ownerName.split(' ').slice(1).join(' ') : '') || 
                  '';

  console.log('Resolving recipient from booking:', {
    email: emailAddr,
    firstName,
    lastName,
    rawBooking: booking
  });

  return { 
    email: emailAddr, 
    name: `${firstName} ${lastName}`.trim() 
  };
}


// Helper to get service type display name
function getServiceDisplay(booking) {
  const { service_name, serviceName, service_type } = booking;
  
  // If it's an overnight service type, always show as Overnight Boarding
  if (service_type === 'overnight') {
    return 'Overnight Boarding';
  }
  
  // Otherwise use the service name
  const service = service_name || serviceName || 'Pet Service';
  return service;
}

/**
 * Send a booking confirmation email
 * @param {Object} booking - Booking data including user and pet details
 * @returns {Promise<Object>} - Email send result
 */
async function sendBookingConfirmation(booking) {
  try {
    const { pet = {}, start_date, end_date, start_time, end_time, special_requests, reference_number } = booking;
    const bookingDate = new Date(start_date).toLocaleDateString();
    const endDate = new Date(end_date).toLocaleDateString();
    const recipient = resolveRecipient(booking);
    const serviceType = getServiceDisplay(booking);
    
    if (!recipient.email) {
      throw new Error('No recipient email found for booking');
    }
    
    // Email content - only send to customer
    const mailOptions = {
      from: `"Baguio Pet Boarding" <${process.env.EMAIL_USER || 'noreply@baguiopetboarding.com'}>`,
      to: recipient.email, // Only send to customer, admin gets a separate notification
      subject: `${serviceType} Booking Pending - Ref #${reference_number} - Baguio Pet Boarding`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <div style="text-align: center; background-color: #4CAF50; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h1>Booking Pending</h1>
          </div>
          
          <div style="padding: 20px;">
            <p>Dear ${recipient.name},</p>
            
            <p>Thank you for booking with Baguio Pet Boarding. Your booking (Reference: <strong>${reference_number || 'N/A'}</strong>) has been received and is currently pending. We will notify you once your booking is confirmed.</p>
            

            
            <p>We will process your booking and get back to you shortly to confirm. If you have any questions, please contact us at ${process.env.CONTACT_PHONE || '+63 912 345 6789'} or reply to this email.</p>
            
            <p>Thank you for choosing Baguio Pet Boarding.</p>
            
            <p>Warm regards,<br>The Baguio Pet Boarding Team</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px;">
            <p>&copy; ${new Date().getFullYear()} Baguio Pet Boarding. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      `
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
    throw error;
  }
}

/**
 * Send a booking status update email
 * @param {Object} booking - Booking data with status update
 * @returns {Promise<Object>} - Email send result
 */
async function sendAdminNotification(booking) {
  try {
    const { reference_number, pet = {} } = booking;
    const customer = resolveRecipient(booking);
    const serviceType = getServiceDisplay(booking);

    const mailOptions = {
      from: `"Baguio Pet Boarding System" <${process.env.EMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: `New ${serviceType} Booking - Action Required`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #2196F3; color: white; padding: 10px; text-align: center;">
            <h2>New Booking Notification</h2>
          </div>
          
          <div style="padding: 20px; border: 1px solid #eee;">
            <p>A new ${serviceType.toLowerCase()} booking has been received.</p>
            
            <h3>Booking Details:</h3>
            <ul>
              <li><strong>Reference #:</strong> ${reference_number || 'N/A'}</li>
              <li><strong>Customer:</strong> ${customer.name}</li>
              <li><strong>Pet:</strong> ${pet.pet_name} (${pet.pet_type})</li>
              <li><strong>Service:</strong> ${serviceType}</li>
            </ul>
            
            <p>Please log in to the admin dashboard to review and take action on this booking.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Admin notification sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending admin notification:', error);
    throw error;
  }
}

async function sendBookingStatusUpdate(booking) {
  try {
    const { pet = {}, bookingDate, status, notes, reference_number } = booking;
    const recipient = resolveRecipient(booking);
    const serviceType = getServiceDisplay(booking);
    
    if (!recipient.email) {
      throw new Error('No recipient email found for booking');
    }
    
    const statusDisplay = {
      confirmed: 'Confirmed',
      cancelled: 'Cancelled',
      completed: 'Completed',
      pending: 'Pending'
    };
    
    const statusColors = {
      confirmed: '#4CAF50',  // Green
      cancelled: '#F44336',  // Red
      completed: '#2196F3',  // Blue
      pending: '#FF9800'     // Orange
    };
    
    const statusMessages = {
      confirmed: 'Great news! Your booking has been confirmed.',
      cancelled: 'Your booking has been cancelled.',
      completed: 'Your booking has been completed. Thank you for choosing us!',
      pending: 'Your booking is currently pending review.'
    };
    
    const mailOptions = {
      from: `"Baguio Pet Boarding" <${process.env.EMAIL_USER || 'noreply@baguiopetboarding.com'}>`,
      to: recipient.email,
      subject: `${serviceType} Booking ${statusDisplay[status] || 'Update'} - Ref #${reference_number || 'N/A'} - Baguio Pet Boarding`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <div style="text-align: center; background-color: ${statusColors[status] || '#4CAF50'}; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h1>Booking ${statusDisplay[status] || 'Update'}</h1>
          </div>
          
          <div style="padding: 20px;">
            <p>Dear ${recipient.name},</p>
            
            <p>${statusMessages[status] || `Your booking status has been updated to <strong>${statusDisplay[status] || status}</strong>.`}</p>
            <p>Reference #: <strong>${reference_number}</strong></p>
            

            
            <p>If you have any questions, please contact us at ${process.env.CONTACT_PHONE || '+63 912 345 6789'} or reply to this email.</p>
            
            <p>Thank you for choosing Baguio Pet Boarding.</p>
            
            <p>Warm regards,<br>The Baguio Pet Boarding Team</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px;">
            <p>&copy; ${new Date().getFullYear()} Baguio Pet Boarding. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      `
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Status update email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending status update email:', error);
    throw error;
  }
}

/**
 * Send notification to admin about new bookings or important updates
 * @param {Object} data - Notification data
 * @returns {Promise<Object>} - Email send result
 * @deprecated Use sendBookingNotification instead for booking-related notifications
 */
async function sendAdminNotification(data) {
  console.warn('sendAdminNotification is deprecated. Use sendBookingNotification for booking notifications.');
  return null;
}

async function sendBookingNotification(data) {
  try {
    const { pet = {}, start_date, end_date, start_time, end_time, special_requests, reference_number } = data;
    const recipient = resolveRecipient(data);
    const serviceType = getServiceDisplay(data);
    const bookingDate = start_date ? new Date(start_date).toLocaleDateString() : 'N/A';
    const endDate = end_date ? new Date(end_date).toLocaleDateString() : 'N/A';
    
    // Determine recipients: if customRecipient is provided, use it; otherwise default to configured admin emails
    let adminEmails;
    if (data.customRecipient) {
      adminEmails = [data.customRecipient];
    } else {
      adminEmails = process.env.ADMIN_EMAILS ?
        process.env.ADMIN_EMAILS.split(',') :
        ['baguiopetboarding@gmail.com']; // Default admin email
    }
    
    if (!adminEmails.length) {
      console.warn('No admin emails configured for notifications');
      return null;
    }

    const recipients = adminEmails.join(',');
    
    const mailOptions = {
      from: `"Baguio Pet Boarding System" <${process.env.EMAIL_USER || 'noreply@baguiopetboarding.com'}>`,
      to: recipients,
      subject: `New ${serviceType} Booking - Ref #${reference_number} - Baguio Pet Boarding`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <div style="text-align: center; background-color: #2196F3; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h1>New Booking Notification</h1>
          </div>
          
          <div style="padding: 20px;">
            <h2>New ${serviceType} Booking Received</h2>
            
            <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0;">
              <h3>Customer Details:</h3>
              <ul style="list-style: none; padding-left: 0;">
                <li><strong>Name:</strong> ${recipient.name}</li>
                <li><strong>Email:</strong> ${recipient.email}</li>
                <li><strong>Phone:</strong> ${data.owner_phone || data.phone || 'N/A'}</li>
                <li><strong>Address:</strong> ${data.owner_address || data.address || 'N/A'}</li>
              </ul>

              <h3>Booking Details:</h3>
              <ul style="list-style: none; padding-left: 0;">
                <li><strong>Reference #:</strong> ${reference_number}</li>
                <li><strong>Service:</strong> ${serviceType}</li>
                <li><strong>Dates:</strong> ${bookingDate} - ${endDate}</li>
                <li><strong>Arriving at:</strong> ${start_time}</li>
              </ul>
            </div>
            
            <p>Please log in to the admin dashboard to take appropriate action.</p>
            <p>Time: ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px;">
            <p>&copy; ${new Date().getFullYear()} Baguio Pet Boarding. All rights reserved.</p>
            <p>This is an automated notification from the system.</p>
          </div>
        </div>
      `
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Admin notification email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending admin notification email:', error);
    throw error;
  }
}

// Wrapper retained for backward compatibility
async function sendNewModification(data) {
  // Send both customer and admin notifications about modification status
  return sendBookingStatusUpdate(data);
}

module.exports = {
  sendBookingConfirmation,
  sendBookingStatusUpdate,
  sendBookingNotification,
  sendAdminNotification,
  sendNewModification
};
