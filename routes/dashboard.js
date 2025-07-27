/**
 * Admin Dashboard Routes
 * Provides statistics and management endpoints for admins
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
require('dotenv').config();
const { verifyToken, isAdmin } = require('../middleware/auth');
const { validateParams, validateQuery, schemas } = require('../middleware/validation');

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get overall booking statistics for dashboard
 * @access  Admin
 */
router.get('/summary', verifyToken, isAdmin, async (req, res) => {
  try {
    // Get current date
    const today = new Date().toISOString().split('T')[0];

    // Get counts by status
    const [statusCounts] = await pool.query(`
      SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN start_date = ? THEN 1 ELSE 0 END) as today_bookings
      FROM bookings
    `, [today]);

    // Get revenue summary
    const [revenue] = await pool.query(`
      SELECT 
        0 as total_revenue,
        0 as today_revenue,
        0 as week_revenue,
        0 as month_revenue,
        COUNT(DISTINCT booking_id) as total_customers
      FROM bookings
      WHERE status != 'cancelled'
    `, [today, today, today, today, today]);

    // Get popular services
    const [popularServices] = await pool.query(`
      SELECT 
        s.service_name,
        COUNT(b.booking_id) as booking_count

      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      WHERE b.status != 'cancelled'
      GROUP BY b.service_id
      ORDER BY booking_count DESC
      LIMIT 5
    `);

    // Get recent bookings
    const [recentBookings] = await pool.query(`
      SELECT 
        b.booking_id,
        b.start_date,
        b.status,

        b.created_at,
        p.pet_name,
        p.pet_type,
        p.gender AS sex,

        s.service_name
      FROM bookings b
      
      LEFT JOIN pets p ON b.pet_id = p.pet_id
      LEFT JOIN services s ON b.service_id = s.service_id
      ORDER BY b.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        stats: statusCounts[0] || {},
        revenue: revenue[0] || {},
        popularServices,
        recentBookings
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/dashboard/bookings/stats
 * @desc    Get booking statistics by date range
 * @access  Admin
 */
router.get('/bookings/stats', verifyToken, isAdmin, validateQuery(schemas.dateRange), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get booking counts by date in range
    const [bookingStats] = await pool.query(`
      SELECT 
        start_date,
        COUNT(booking_id) as total_count,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
       
      FROM bookings
      WHERE booking_date BETWEEN ? AND ?
      GROUP BY booking_date
      ORDER BY booking_date
    `, [startDate, endDate]);
    
    // Get bookings by service type
    const [serviceStats] = await pool.query(`
      SELECT 
        s.service_name,
        s.service_type,
        COUNT(b.booking_id) as booking_count

      FROM bookings b
      JOIN services s ON b.service_id = s.service_id
      WHERE b.booking_date BETWEEN ? AND ?
      GROUP BY b.service_id
      ORDER BY booking_count DESC
    `, [startDate, endDate]);
    
    res.json({
      success: true,
      data: {
        bookingsByDate: bookingStats,
        bookingsByService: serviceStats
      }
    });
  } catch (error) {
    console.error('Error fetching booking statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/dashboard/services/availability
 * @desc    Get service availability for the next 30 days
 * @access  Admin
 */
router.get('/services/availability', verifyToken, isAdmin, async (req, res) => {
  try {
    // Get current date
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    
    // Get date 30 days from now
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);
    const endDateFormatted = endDate.toISOString().split('T')[0];
    
    // Get all services
    const [services] = await pool.query(`
      SELECT service_id, service_name, max_slots, service_type
      FROM services
      ORDER BY service_type, service_name
    `);
    
    // Get calendar availability for date range
    const [calendarAvailability] = await pool.query(`
      SELECT date, is_available, reason, notes
      FROM calendar_availability
      WHERE date BETWEEN ? AND ?
      ORDER BY date
    `, [startDate, endDateFormatted]);
    
    // Get bookings for date range - we need to get all bookings that overlap with any day in our range
    const [bookings] = await pool.query(`
      SELECT 
        start_date,
        service_id,
        COUNT(*) as booking_count
      FROM bookings
      WHERE start_date <= ? AND end_date >= ? AND status != 'cancelled'
      GROUP BY start_date, service_id
    `, [endDateFormatted, startDate]);
    
    // Create availability map for each date and service
    const availabilityMap = {};
    
    // Process calendar unavailability first
    calendarAvailability.forEach(day => {
      if (!day.is_available) {
        availabilityMap[day.date] = {
          date: day.date,
          isAvailable: false,
          reason: day.reason,
          services: {}
        };
      }
    });
    
    // Process each date in range
    let currentDate = new Date(today);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // If date not already marked as unavailable from calendar
      if (!availabilityMap[dateStr]) {
        availabilityMap[dateStr] = {
          date: dateStr,
          isAvailable: true,
          services: {}
        };
        
        // Initialize availability for each service
        services.forEach(service => {
          availabilityMap[dateStr].services[service.service_id] = {
            id: service.service_id,
            name: service.service_name,
            type: service.service_type,
            maxSlots: service.max_slots,
            bookedSlots: 0,
            availableSlots: service.max_slots
          };
        });
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Update with booking counts
    bookings.forEach(booking => {
      if (availabilityMap[booking.start_date] && 
          availabilityMap[booking.start_date].isAvailable &&
          availabilityMap[booking.start_date].services[booking.service_id]) {
            
        availabilityMap[booking.start_date].services[booking.service_id].bookedSlots = booking.booking_count;
        availabilityMap[booking.start_date].services[booking.service_id].availableSlots = 
          Math.max(0, availabilityMap[booking.start_date].services[booking.service_id].maxSlots - booking.booking_count);
      }
    });
    
    // Convert map to array
    const availabilityArray = Object.values(availabilityMap);
    
    res.json({
      success: true,
      data: availabilityArray
    });
  } catch (error) {
    console.error('Error fetching service availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/dashboard/customers
 * @desc    Get customer statistics
 * @access  Admin
 */
router.get('/customers', verifyToken, isAdmin, async (req, res) => {
  try {
    // Get customer booking stats
    const [customerStats] = await pool.query(`
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        COUNT(b.booking_id) as booking_count

        MAX(b.booking_date) as last_booking_date,
        STRING_AGG(DISTINCT p.pet_name, ', ' ORDER BY p.pet_name) as pet_names
      FROM users u
      LEFT JOIN bookings b ON u.user_id = b.user_id
      LEFT JOIN pets p ON b.pet_id = p.pet_id
      WHERE u.role = 'customer'
      GROUP BY u.user_id
      ORDER BY booking_count DESC
      LIMIT 100
    `);
    
    // Get new customers in last 30 days
    const [newCustomers] = await pool.query(`
      SELECT COUNT(DISTINCT u.user_id) as new_customer_count
      FROM users u
      WHERE u.role = 'customer' AND u.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    `);
    
    // Get repeat customer percentage
    const [repeatStats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT booking_id) as customer_count,
        SUM(CASE WHEN booking_count > 1 THEN 1 ELSE 0 END) as repeat_customer_count
      FROM (
        SELECT 
          user_id,
          COUNT(booking_id) as booking_count
        FROM bookings
        WHERE status != 'cancelled'
        GROUP BY user_id
      ) as customer_bookings
    `);
    
    const repeatPercentage = repeatStats[0].customer_count > 0 
      ? Math.round((repeatStats[0].repeat_customer_count / repeatStats[0].customer_count) * 100)
      : 0;
    
    res.json({
      success: true,
      data: {
        customers: customerStats,
        stats: {
          totalCustomers: repeatStats[0].customer_count || 0,
          repeatCustomers: repeatStats[0].repeat_customer_count || 0,
          repeatPercentage,
          newCustomersLast30Days: newCustomers[0].new_customer_count || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching customer statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
