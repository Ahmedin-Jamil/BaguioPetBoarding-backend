/**
 * API Testing Script for Baguio Pet Boarding
 * 
 * This script tests all API endpoints to verify they work correctly with
 * the new validation schemas and standardized response format.
 */

const fetch = require('node-fetch');
const chalk = require('chalk').default;

// Base URL for API tests
const API_BASE_URL = 'http://localhost:3001/api';

// Test result tracking
let passedTests = 0;
let failedTests = 0;

// Helper function to log test results
function logTest(name, success, expectedStatus, actualStatus, response) {
  if (success) {
    console.log(chalk.green(`✓ PASS: ${name}`));
    passedTests++;
  } else {
    console.log(chalk.red(`✗ FAIL: ${name}`));
    console.log(chalk.yellow(`  Expected status: ${expectedStatus}, Got: ${actualStatus}`));
    if (response) {
      console.log(chalk.yellow('  Response:'), response);
    }
    failedTests++;
  }
}

// Helper function to make API requests
async function apiRequest(method, endpoint, data = null, expectedStatus = 200) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const responseData = await response.json();
    
    return {
      success: response.status === expectedStatus,
      status: response.status,
      data: responseData,
    };
  } catch (error) {
    return {
      success: false,
      status: 500,
      data: { error: error.message },
    };
  }
}

// Test Services API
async function testServicesAPI() {
  console.log(chalk.blue('\n=== Testing Services API ==='));
  
  // Test get all services
  const servicesTest = await apiRequest('GET', '/services');
  logTest(
    'Get All Services', 
    servicesTest.success && servicesTest.data.success === true,
    200,
    servicesTest.status,
    servicesTest.data
  );

  // Test service availability for a specific date
  const date = new Date();
  const formattedDate = date.toISOString().split('T')[0];
  const availabilityTest = await apiRequest('GET', `/services/availability/${formattedDate}`);
  logTest(
    'Get Service Availability for Date',
    availabilityTest.success && availabilityTest.data.success === true,
    200,
    availabilityTest.status,
    availabilityTest.data
  );

  // Test calendar availability for a specific date
  const calendarTest = await apiRequest('GET', `/services/calendar-availability/${formattedDate}`);
  logTest(
    'Get Calendar Availability for Date',
    calendarTest.success && calendarTest.data.success === true,
    200,
    calendarTest.status,
    calendarTest.data
  );

  // Test calendar availability for date range
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const formattedNextWeek = nextWeek.toISOString().split('T')[0];
  
  const rangeTest = await apiRequest(
    'GET', 
    `/services/calendar-availability?startDate=${formattedDate}&endDate=${formattedNextWeek}`
  );
  logTest(
    'Get Calendar Availability for Date Range',
    rangeTest.success && rangeTest.data.success === true,
    200,
    rangeTest.status,
    rangeTest.data
  );

  // Test with invalid date format (validation test)
  const invalidDateTest = await apiRequest('GET', '/services/availability/invalid-date', null, 400);
  logTest(
    'Invalid Date Format Validation',
    invalidDateTest.success && invalidDateTest.data.success === false,
    400,
    invalidDateTest.status,
    invalidDateTest.data
  );
}

// Test Bookings API
async function testBookingsAPI() {
  console.log(chalk.blue('\n=== Testing Bookings API ==='));
  
  // Test get all bookings
  const bookingsTest = await apiRequest('GET', '/bookings');
  logTest(
    'Get All Bookings',
    bookingsTest.success && bookingsTest.data.success === true,
    200,
    bookingsTest.status,
    bookingsTest.data
  );

  // Test search bookings with missing parameters (validation test)
  const invalidSearchTest = await apiRequest('GET', '/bookings/search', null, 400);
  logTest(
    'Search Without Parameters Validation',
    invalidSearchTest.success && invalidSearchTest.data.success === false,
    400,
    invalidSearchTest.status,
    invalidSearchTest.data
  );

  // Test search bookings with email
  const searchTest = await apiRequest('GET', '/bookings/search?email=test@example.com');
  logTest(
    'Search Bookings by Email',
    searchTest.success,
    200,
    searchTest.status,
    searchTest.data
  );

  // Test create booking with valid data
  const validBooking = {
    user: {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone: '+6391234567890',
      address: 'Test Address'
    },
    pet: {
      pet_name: 'TestPet',
      pet_type: 'dog',
      breed: 'Labrador',
      age: 3,
      weight: 25.5,
      gender: 'Male',
      special_instructions: 'Testing instructions'
    },
    serviceId: 1,
    bookingDate: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '17:00',
    totalAmount: 800.00,
    specialRequests: 'This is a test booking'
  };

  const createBookingTest = await apiRequest('POST', '/bookings', validBooking, 201);
  logTest(
    'Create Booking with Valid Data',
    createBookingTest.success && createBookingTest.data.success === true,
    201,
    createBookingTest.status,
    createBookingTest.data
  );

  // Test create booking with invalid data (validation test)
  const invalidBooking = {
    user: {
      first_name: '',  // Missing required field
      last_name: 'User',
      email: 'invalid-email',  // Invalid email format
      phone: '+123'  // Invalid phone format
    },
    pet: {
      pet_name: 'TestPet',
      pet_type: 'alien',  // Invalid pet type
      breed: 'Unknown'
    },
    serviceId: 999,  // Non-existent service ID
    bookingDate: 'tomorrow'  // Invalid date format
  };

  const invalidBookingTest = await apiRequest('POST', '/bookings', invalidBooking, 400);
  logTest(
    'Create Booking with Invalid Data Validation',
    invalidBookingTest.success && invalidBookingTest.data.success === false,
    400,
    invalidBookingTest.status,
    invalidBookingTest.data
  );

  // Get a booking ID from previous successful test if available
  let bookingId = null;
  if (createBookingTest.success && createBookingTest.data.bookingId) {
    bookingId = createBookingTest.data.bookingId;
  }

  // Test update booking status (if we have a booking ID)
  if (bookingId) {
    const updateStatusTest = await apiRequest(
      'PUT',
      `/bookings/${bookingId}/status`,
      { status: 'confirmed', notes: 'Auto-confirmed by test' }
    );
    logTest(
      'Update Booking Status',
      updateStatusTest.success && updateStatusTest.data.success === true,
      200,
      updateStatusTest.status,
      updateStatusTest.data
    );

    // Test with invalid status (validation test)
    const invalidStatusTest = await apiRequest(
      'PUT',
      `/bookings/${bookingId}/status`,
      { status: 'invalid-status' },
      400
    );
    logTest(
      'Update with Invalid Status Validation',
      invalidStatusTest.success && invalidStatusTest.data.success === false,
      400,
      invalidStatusTest.status,
      invalidStatusTest.data
    );
  }
}

// Test Calendar API
async function testCalendarAPI() {
  console.log(chalk.blue('\n=== Testing Calendar API ==='));
  
  // Test get calendar availability for date range
  const date = new Date();
  const formattedDate = date.toISOString().split('T')[0];
  
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const formattedNextWeek = nextWeek.toISOString().split('T')[0];
  
  const rangeTest = await apiRequest(
    'GET', 
    `/calendar?startDate=${formattedDate}&endDate=${formattedNextWeek}`
  );
  logTest(
    'Get Calendar Availability for Date Range',
    rangeTest.success && rangeTest.data.success === true,
    200,
    rangeTest.status,
    rangeTest.data
  );

  // Test mark date as unavailable
  const markUnavailableTest = await apiRequest(
    'POST',
    '/calendar/unavailable',
    {
      date: formattedNextWeek,
      reason: 'Testing',
      notes: 'Marked as unavailable by API test',
      adminId: 1
    },
    201
  );
  logTest(
    'Mark Date as Unavailable',
    markUnavailableTest.success && markUnavailableTest.data.success === true,
    201,
    markUnavailableTest.status,
    markUnavailableTest.data
  );

  // Test mark date as available
  const markAvailableTest = await apiRequest(
    'POST',
    '/calendar/available',
    {
      date: formattedNextWeek,
      adminId: 1
    },
    200
  );
  logTest(
    'Mark Date as Available',
    markAvailableTest.success && markAvailableTest.data.success === true,
    200,
    markAvailableTest.status,
    markAvailableTest.data
  );

  // Test with invalid date format (validation test)
  const invalidDateTest = await apiRequest(
    'POST',
    '/calendar/unavailable',
    {
      date: 'invalid-date',
      reason: 'Testing',
      adminId: 1
    },
    400
  );
  logTest(
    'Invalid Date Format Validation',
    invalidDateTest.success && invalidDateTest.data.success === false,
    400,
    invalidDateTest.status,
    invalidDateTest.data
  );
}

// Main test function
async function runTests() {
  console.log(chalk.bgBlue.white`\n 🐾 BAGUIO PET BOARDING API TESTS 🐾 \n`);
  console.log(chalk.yellow(`Testing API at: ${API_BASE_URL}\n`));
  
  try {
    await testServicesAPI();
    await testBookingsAPI();
    await testCalendarAPI();
    
    // Output summary
    console.log(chalk.blue('\n=== Test Summary ==='));
    console.log(chalk.green(`Passed Tests: ${passedTests}`));
    console.log(chalk.red(`Failed Tests: ${failedTests}`));
    console.log(chalk.blue(`Total Tests: ${passedTests + failedTests}`));
    
    if (failedTests === 0) {
      console.log(chalk.bgGreen.black('\n 🎉 All tests passed! 🎉 \n'));
    } else {
      console.log(chalk.bgRed.white(`\n ❌ ${failedTests} test(s) failed! ❌ \n`));
    }
  } catch (error) {
    console.error(chalk.red('\nTest execution error:'), error);
  }
}

// Run the tests
runTests();
