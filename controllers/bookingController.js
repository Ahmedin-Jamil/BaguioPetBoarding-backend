/**
 * Booking Controller
 * Handles business logic for booking operations
 */

// Use flattened booking model (no users/pets tables)
const bookingModel = require('../models/booking_flat');
const { pool, formatDateString } = require('../config/db');
const emailService = require('../services/emailService');

/**
 * Get all bookings with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getBookings(req, res) {
  try {
    // Extract query parameters
    const {
      status,
      serviceType,
      roomType,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortDir
    } = req.query;
    
    const options = {
      status,
      serviceType,
      roomType,
      startDate: startDate ? formatDateString(startDate) : null,
      endDate: endDate ? formatDateString(endDate) : null,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || 'booking_date',
      sortDir: sortDir || 'DESC'
    };
    
    const result = await bookingModel.getBookings(options);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in booking controller:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving bookings',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get booking details by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await bookingModel.getBookingById(id);
    
    if (!result.success) {
      return res.status(result.message === 'Booking not found' ? 404 : 500).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting booking details:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving booking details',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Create a new booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createBooking(req, res) {
  // All bookings are treated as guest bookings
  let isGuestBooking = req.body.guest_booking_only === true;

  try {
    const bookingData = req.body;

    /* ------------------------------------------------------------------
       1.  BUILD FALLBACK guest_user / guest_pet STRUCTURE
       ------------------------------------------------------------------*/
    // Derive guest_user from top-level owner_* fields if the object is missing
    if (!bookingData.guest_user) {
      const ownerName = bookingData.owner_name || `${bookingData.owner_first_name || ''} ${bookingData.owner_last_name || ''}`.trim();
      if (ownerName || bookingData.owner_email || bookingData.owner_phone) {
        bookingData.guest_user = {
          name       : ownerName || undefined,
          first_name : bookingData.owner_first_name,
          last_name  : bookingData.owner_last_name,
          email      : bookingData.owner_email,
          phone      : bookingData.owner_phone,
          address    : bookingData.owner_address
        };
      }
    }

    // Derive guest_pet from top-level pet_* fields if the object is missing
    if (!bookingData.guest_pet) {
      if (bookingData.pet_name || bookingData.pet_type) {
        bookingData.guest_pet = {
          pet_name       : bookingData.pet_name,
          pet_type       : bookingData.pet_type,
          breed          : bookingData.breed,
          gender         : bookingData.gender,
          weight_category: bookingData.weight_category,
          date_of_birth  : bookingData.date_of_birth
        };
      }
    }

    // Ensure top-level pet_type and weight_category are populated from guest_pet for later validation
    if (!bookingData.pet_type && bookingData.guest_pet?.pet_type) {
      bookingData.pet_type = bookingData.guest_pet.pet_type;
    }
    if (!bookingData.weight_category && bookingData.guest_pet?.weight_category) {
      bookingData.weight_category = bookingData.guest_pet.weight_category;
    }
    // Determine if this is a guest booking (no authenticated user)
    const isGuestBooking = bookingData.guest_booking_only || !!bookingData.guest_user;
    
    // If it's marked as guest booking but guest_user is null, try to build it from top-level fields
    if (isGuestBooking && !bookingData.guest_user) {
      // Split ownerName into first and last name if available
      let firstName = '', lastName = '';
      if (bookingData.ownerName) {
        const nameParts = bookingData.ownerName.split(' ');
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else {
          firstName = bookingData.ownerName;
        }
      }

      // Create guest_user with schema-matching field names
      bookingData.guest_user = {
        owner_first_name: firstName,
        owner_last_name: lastName,
        owner_email: bookingData.ownerEmail || '',
        owner_phone: bookingData.ownerPhone || '',
        owner_address: bookingData.ownerAddress || ''
      };
    }
    
    // Validate required guest information
    // Build list of missing fields
    const missingFields = [];
    const guest = bookingData.guest_user || {};
    
    // Check required owner fields based on schema
    if (!bookingData.ownerName) {
      missingFields.push('name');
    }
    if (!bookingData.ownerEmail) {
      missingFields.push('email');
    }
    if (!bookingData.ownerPhone) {
      missingFields.push('phone number');
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please fill in the Owner Details section. Missing: ${missingFields.join(', ')}.`,
        missingFields,
        timestamp: new Date().toISOString()
      });
    }

    // Validate guest user information
    const guestUserInfo = bookingData.guest_user || {};
    const contactEmail = guestUserInfo.owner_email || bookingData.ownerEmail || bookingData.email;
    const contactPhone = guestUserInfo.owner_phone || bookingData.ownerPhone || bookingData.phone;
    const contactName  = bookingData.ownerName || [guestUserInfo.owner_first_name, guestUserInfo.owner_last_name].filter(Boolean).join(' ');

    if (!contactEmail || !contactPhone || !contactName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required guest contact information (owner name, email, phone)',
        timestamp: new Date().toISOString()
      });
    }

    // Validate mandatory common fields
    if ((!bookingData.service_id && !bookingData.service_type) || !bookingData.booking_date || !bookingData.pet_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required booking information (service type, booking date, or pet type)',
        timestamp: new Date().toISOString()
      });
    }

    // Validate pet type
    if (!['Dog', 'Cat'].includes(bookingData.pet_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pet type. Must be either Dog or Cat',
        timestamp: new Date().toISOString()
      });
    }

    // Get service details to check cat allowance and service type
    let serviceRows;
    if (bookingData.service_id) {
      ({ rows: serviceRows } = await pool.query('SELECT * FROM services WHERE service_id = $1', [bookingData.service_id]));
    } else {
      ({ rows: serviceRows } = await pool.query('SELECT * FROM services WHERE service_type = $1', [bookingData.service_type]));
    }
    if (serviceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
        timestamp: new Date().toISOString()
      });
    }

    const service = serviceRows[0];

    // Check if the selected service can accept cats
    if (bookingData.pet_type === 'Cat') {
      // Some legacy records may not have an explicit `allows_cat` flag.
      // Fall back to checking if a cat-specific price is defined (price_cat_small or price_cat_medium not null).
      // For overnight/daycare services we treat cats the same as dogs, so allow them even if cat prices are null.
      const serviceAllowsCat = service.hasOwnProperty('allows_cat')
        ? Boolean(service.allows_cat)
        : ((service.price_cat_small !== null || service.price_cat_medium !== null) || service.service_type === 'overnight' || service.service_type === 'daycare');

      if (!serviceAllowsCat) {
        return res.status(400).json({
          success: false,
          message: 'This service does not accept cats',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Validate weight category for dogs and non-grooming services for cats
    // Require weight category for dogs always. For cats, require only for non-grooming services but accept the literal "Cat" as a valid category.
    if (bookingData.pet_type === 'Dog' || (bookingData.pet_type === 'Cat' && service.service_type !== 'grooming')) {
      if (!bookingData.weight_category || !['Small', 'Medium', 'Large', 'X-Large', 'Cat'].includes(bookingData.weight_category)) {
        return res.status(400).json({
          success: false,
          message: 'Valid weight category is required for dogs and cats in overnight/daycare services',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Create a clean copy of the booking data to avoid reference issues
    const bookingDataCopy = {
      ...req.body,
      guest_booking_only: isGuestBooking
    };

    // For guest bookings, ensure guest_user and guest_pet are properly set
    if (isGuestBooking) {
      // Ensure weight_category and date_of_birth are available at the top level
      // Ensure guest_pet has weight_category and date_of_birth
      if (req.body.guest_pet) {
        // Extract weight_category from all possible sources
        const weightCategory = 
          req.body.guest_pet.weight_category || 
          req.body.guest_pet.weightCategory || 
          req.body.weight_category || 
          req.body.weightCategory || 
          'Medium'; // Default fallback
        
        // Extract date_of_birth from all possible sources
        const dateOfBirth = 
          req.body.guest_pet.date_of_birth || 
          req.body.guest_pet.dateOfBirth || 
          req.body.date_of_birth || 
          req.body.dateOfBirth || 
          '2020-01-01'; // Default fallback
        
        // Create a complete guest_pet object with all required fields
        bookingDataCopy.guest_pet = {
          ...req.body.guest_pet,
          weight_category: weightCategory,
          date_of_birth: dateOfBirth
        };
        
        // Also set these at the top level for the model layer
        bookingDataCopy.weight_category = weightCategory;
        bookingDataCopy.date_of_birth = dateOfBirth;
      }
    }
    
    const result = await bookingModel.createBooking(bookingDataCopy);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    // Send booking confirmation and admin notification (non-blocking)
    (async () => {
      try {
        await Promise.all([
          emailService.sendBookingConfirmation(result.data),
          emailService.sendBookingNotification(result.data)
        ]);
      } catch (emailErr) {
        console.error('Failed to send booking notifications:', emailErr.message);
      }
    })();

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating booking',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Update booking status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!id || !status) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and status are required',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await bookingModel.updateBookingStatus(id, status);
    
    if (!result.success) {
      return res.status(result.message === 'Booking not found' ? 404 : 400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating booking status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Count bookings by service and room for a specific date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function countBookingsByServiceAndRoom(req, res) {
  try {
    const { date, serviceType, roomType } = req.query;
    
    if (!date || !serviceType) {
      return res.status(400).json({
        success: false,
        message: 'Date and service type are required',
        timestamp: new Date().toISOString()
      });
    }
    
    const count = await bookingModel.countBookingsByServiceAndRoom(
      date,
      serviceType,
      roomType
    );
    
    res.json({
      success: true,
      data: { count },
      message: 'Booking count retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error counting bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error counting bookings',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
/**
 * Get pending bookings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getPendingBookings(req, res) {
  try {
    // Set status filter to 'pending' for the model
    const options = {
      status: 'pending',
      page: req.query.page ? parseInt(req.query.page, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
      sortBy: 'created_at',
      sortDir: 'ASC'
    };
    
    const result = await bookingModel.getBookings(options);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting pending bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving pending bookings',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Search bookings by email or booking_id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function searchBookings(req, res) {
  try {
    const { email, booking_id } = req.query;
    
    if (!email && !booking_id) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either email or booking_id',
        timestamp: new Date().toISOString()
      });
    }
    
    let result;
    
    if (booking_id) {
      // If booking ID is provided, get that specific booking
      result = await bookingModel.getBookingById(booking_id);
    } else {
      // If email is provided, get all bookings for that email
      // Using the getBookings function with a custom filter
      const options = {
        email: email,
        page: req.query.page ? parseInt(req.query.page, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
        sortBy: 'created_at',
        sortDir: 'DESC'
      };
      
      result = await bookingModel.getBookings(options);
    }
    
    if (!result.success) {
      return res.status(result.message.includes('not found') ? 404 : 500).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error searching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching bookings',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get booking summary by date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getBookingSummary(req, res) {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await bookingModel.getBookingSummary(date);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error generating booking summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating booking summary',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  countBookingsByServiceAndRoom,
  getPendingBookings,
  searchBookings,
  getBookingSummary
};
