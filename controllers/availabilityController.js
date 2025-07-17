/**
 * Availability Controller
 * Handles business logic for room and service availability
 */

const availabilityModel = require('../models/availability');
const { formatDateString } = require('../config/db');

/**
 * Get room availability for a specific date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getRoomAvailability(req, res) {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Parse and format date
    const formattedDate = formatDateString(date);
    
    // Log what we're looking for
    console.log(`Checking room availability for date: ${formattedDate}`);
    
    const roomAvailability = await availabilityModel.getRoomAvailability(formattedDate);
    
    if (!roomAvailability.success) {
      return res.status(500).json({
        success: false,
        message: roomAvailability.message,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(roomAvailability);
  } catch (error) {
    console.error('Error in availability controller:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving room availability',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Check if a specific service is available on a date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function checkServiceAvailability(req, res) {
  try {
    const { date, serviceType, roomType, serviceId } = req.query;
    
    if (!date || !serviceType) {
      return res.status(400).json({
        success: false,
        message: 'Date and service type parameters are required',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await availabilityModel.checkServiceAvailability(
      date,
      serviceType,
      roomType,
      serviceId ? parseInt(serviceId, 10) : null
    );
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error checking service availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking service availability',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get unavailable dates for a service
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUnavailableDates(req, res) {
  try {
    const { serviceType, roomType, startDate, endDate } = req.query;
    
    if (!serviceType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Service type, start date, and end date are required',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await availabilityModel.getUnavailableDates(
      serviceType,
      roomType,
      startDate,
      endDate
    );
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting unavailable dates:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving unavailable dates',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getRoomAvailability,
  checkServiceAvailability,
  getUnavailableDates
};
