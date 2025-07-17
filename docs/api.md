# Pet Hotel API Documentation

This document provides comprehensive documentation for the Pet Hotel Booking API.

## Table of Contents
- [Authentication](#authentication)
- [Response Format](#response-format)
- [Services API](#services-api)
- [Bookings API](#bookings-api)
- [Calendar API](#calendar-api)
- [Dashboard API](#dashboard-api)
- [Email Notifications](#email-notifications)
- [Error Handling](#error-handling)

## Authentication API

Endpoints for user registration, login, profile management, and password reset.

### Register a new user

**Endpoint:** `POST /api/auth/register`

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+6391234567890",
  "password": "secure_password123"
}
```

**Response Example:**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 123,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+6391234567890"
  }
}
```

### Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**

```json
{
  "email": "john.doe@example.com",
  "password": "secure_password123"
}
```

**Response Example:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "user"
    }
  }
}
```

### Get User Profile

**Endpoint:** `GET /api/auth/me`

**Headers:**
- `Authorization`: Bearer token

**Response Example:**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+6391234567890",
    "role": "user",
    "created_at": "2023-05-15T08:30:00Z"
  }
}
```

### Forgot Password

**Endpoint:** `POST /api/auth/forgot-password`

**Request Body:**

```json
{
  "email": "john.doe@example.com"
}
```

**Response Example:**

```json
{
  "success": true,
  "message": "If your email is registered, you will receive password reset instructions."
}
```

### Validate Reset Token

**Endpoint:** `GET /api/auth/reset-password/:token`

**Parameters:**
- `token` (path parameter): Password reset token

**Response Example (Valid Token):**

```json
{
  "success": true,
  "message": "Valid reset token",
  "data": {
    "userId": 123,
    "email": "john.doe@example.com"
  }
}
```

**Response Example (Invalid Token):**

```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

### Reset Password

**Endpoint:** `POST /api/auth/reset-password`

**Request Body:**

```json
{
  "token": "65f23a1b7c9d8e4f...",
  "password": "new_secure_password456"
}
```

**Response Example:**

```json
{
  "success": true,
  "message": "Password has been reset successfully"
}
```

### Change Password (Authenticated)

**Endpoint:** `POST /api/auth/change-password`

**Headers:**
- `Authorization`: Bearer token

**Request Body:**

```json
{
  "currentPassword": "current_password123",
  "newPassword": "new_password456"
}
```

**Response Example:**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

## Response Format

All API responses follow a consistent structure:

```json
{
  "success": true,
  "data": {}, // Response data specific to the endpoint
  "message": "Optional status message"
}
```

For errors:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "message": "Detailed error message",
      "path": ["field", "with", "error"]
    }
  ]
}
```

## Services API

### Get All Services

Returns all available services with current slot availability.

**Endpoint:** `GET /api/services`

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "service_id": 1,
      "service_name": "Deluxe Room",
      "service_type": "overnight",
      "price": 800.00,
      "category_name": "Boarding",
      "max_slots": 10,
      "booked_slots": 2,
      "available_slots": 8,
      "duration_hours": 24,
      "description": "Standard overnight boarding service with comfortable bedding and regular feeding."
    },
    {
      "service_id": 2,
      "service_name": "Premium Room",
      "service_type": "overnight",
      "price": 1200.00,
      "category_name": "Boarding",
      "max_slots": 5,
      "booked_slots": 1,
      "available_slots": 4,
      "duration_hours": 24,
      "description": "Premium overnight boarding with extra space and premium bedding."
    }
  ]
}
```

### Get Service Availability for Date

Returns service availability for a specific date.

**Endpoint:** `GET /api/services/availability/:date`

**Parameters:**
- `date` (path parameter): Date in YYYY-MM-DD format

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "service_id": 1,
      "service_name": "Deluxe Room",
      "service_type": "overnight",
      "category_name": "Boarding",
      "max_slots": 10,
      "booked_slots": 3,
      "available_slots": 7,
      "price": 800.00
    },
    {
      "service_id": 2,
      "service_name": "Premium Room",
      "service_type": "overnight",
      "category_name": "Boarding",
      "max_slots": 5,
      "booked_slots": 2,
      "available_slots": 3,
      "price": 1200.00
    }
  ]
}
```

### Check Calendar Availability for Date

Returns the calendar availability status for a specific date.

**Endpoint:** `GET /api/services/calendar-availability/:date`

**Parameters:**
- `date` (path parameter): Date in YYYY-MM-DD format

**Response Example:**

```json
{
  "success": true,
  "data": {
    "date": "2025-06-15",
    "is_available": true,
    "reason": null,
    "notes": null
  }
}
```

**Response Example (Unavailable Date):**

```json
{
  "success": true,
  "data": {
    "date": "2025-06-20",
    "is_available": false,
    "reason": "Public Holiday",
    "notes": "Closed for Independence Day"
  }
}
```

### Get Calendar Availability Range

Returns calendar availability for a date range.

**Endpoint:** `GET /api/services/calendar-availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

**Parameters:**
- `startDate` (query parameter): Start date in YYYY-MM-DD format
- `endDate` (query parameter): End date in YYYY-MM-DD format

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "date": "2025-06-15",
      "is_available": true,
      "reason": null,
      "notes": null
    },
    {
      "date": "2025-06-16",
      "is_available": true,
      "reason": null,
      "notes": null
    },
    {
      "date": "2025-06-20",
      "is_available": false,
      "reason": "Public Holiday",
      "notes": "Closed for Independence Day"
    }
  ]
}
```

## Bookings API

### Get All Bookings (Admin)

Returns all bookings, optionally filtered by date.

**Endpoint:** `GET /api/bookings`

**Query Parameters:**
- `date` (optional): Filter bookings by date (YYYY-MM-DD)

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "booking_id": 123,
      "booking_date": "2025-06-15",
      "start_time": "08:00:00",
      "end_time": "17:00:00",
      "status": "confirmed",
      "total_amount": 800.00,
      "special_requests": "Please provide extra bed",
      "admin_notes": null,
      "created_at": "2025-06-10T12:30:45.000Z",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+6391234567890",
      "pet_name": "Max",
      "pet_type": "dog",
      "breed": "Labrador",
      "age": 3,
      "special_instructions": "Allergic to chicken",
      "service_name": "Deluxe Room",
      "service_type": "overnight",
      "category_name": "Boarding"
    }
  ]
}
```

### Get Pending Bookings (Admin)

Returns all bookings with pending status.

**Endpoint:** `GET /api/bookings/pending`

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "booking_id": 124,
      "booking_date": "2025-06-16",
      "start_time": "09:00:00",
      "status": "pending",
      "created_at": "2025-06-10T13:45:22.000Z",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane.smith@example.com",
      "phone": "+6399876543210",
      "pet_name": "Bella",
      "pet_type": "cat",
      "service_name": "Premium Room",
      "category_name": "Boarding"
    }
  ]
}
```

### Search Bookings

Search bookings by email or booking ID.

**Endpoint:** `GET /api/bookings/search`

**Query Parameters:**
- `email`: Customer email address (required if booking_id not provided)
- `booking_id`: Booking ID (required if email not provided)

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "booking_id": 123,
      "booking_date": "2025-06-15",
      "start_time": "08:00:00",
      "end_time": "17:00:00",
      "status": "confirmed",
      "total_amount": 800.00,
      "special_requests": "Please provide extra bed",
      "created_at": "2025-06-10T12:30:45.000Z",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+6391234567890",
      "pet_name": "Max",
      "pet_type": "dog",
      "breed": "Labrador",
      "service_name": "Deluxe Room",
      "service_type": "overnight",
      "category_name": "Boarding"
    }
  ]
}
```

### Create a Booking

Creates a new booking.

**Endpoint:** `POST /api/bookings`

**Request Body:**

```json
{
  "user": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+6391234567890",
    "address": "123 Main St, Baguio City"
  },
  "pet": {
    "pet_name": "Max",
    "pet_type": "dog",
    "breed": "Labrador",
    "age": 3,
    "weight": 25.5,
    "gender": "Male",
    "special_instructions": "Allergic to chicken",
    "medical_conditions": "None",
    "emergency_contact": "+6391234567899"
  },
  "serviceId": 1,
  "bookingDate": "2025-06-15",
  "startTime": "08:00",
  "endTime": "17:00",
  "totalAmount": 800.00,
  "specialRequests": "Please provide extra bed"
}
```

**Response Example:**

```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "bookingId": 123
  }
}
```

### Update Booking Status

Updates the status of a booking.

**Endpoint:** `PUT /api/bookings/:id/status`

**URL Parameters:**
- `id`: Booking ID

**Request Body:**

```json
{
  "status": "confirmed",
  "notes": "Customer called to confirm",
  "adminId": 1
}
```

**Response Example:**

```json
{
  "success": true,
  "message": "Booking status updated to confirmed successfully",
  "data": {
    "status": "confirmed"
  }
}
```

### Get Booking Summary By Date (Admin)

Returns a summary of bookings for a specific date.

**Endpoint:** `GET /api/bookings/summary/:date`

**Parameters:**
- `date` (path parameter): Date in YYYY-MM-DD format

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "booking_date": "2025-06-15",
      "service_name": "Deluxe Room",
      "category_name": "Boarding",
      "total_bookings": 5,
      "pending_count": 1,
      "confirmed_count": 3,
      "completed_count": 0,
      "cancelled_count": 1,
      "total_revenue": 3200.00
    },
    {
      "booking_date": "2025-06-15",
      "service_name": "Premium Room",
      "category_name": "Boarding",
      "total_bookings": 3,
      "pending_count": 1,
      "confirmed_count": 2,
      "completed_count": 0,
      "cancelled_count": 0,
      "total_revenue": 2400.00
    }
  ]
}
```

## Calendar API

### Get Calendar Availability for Date Range

Returns calendar availability for a date range.

**Endpoint:** `GET /api/calendar?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

**Query Parameters:**
- `startDate`: Start date in YYYY-MM-DD format (required)
- `endDate`: End date in YYYY-MM-DD format (required)

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "date": "2025-06-20",
      "is_available": false,
      "reason": "Public Holiday",
      "notes": "Closed for Independence Day"
    },
    {
      "date": "2025-06-21",
      "is_available": true,
      "reason": null,
      "notes": null
    }
  ]
}
```

## Dashboard API

### Dashboard Summary

Get overall booking statistics for the admin dashboard.

**Endpoint:** `GET /api/dashboard/summary`

**Auth Required:** Admin

**Response Example:**

```json
{
  "success": true,
  "data": {
    "stats": {
      "total_bookings": 120,
      "pending_count": 15,
      "confirmed_count": 95,
      "completed_count": 85,
      "cancelled_count": 10,
      "today_bookings": 5
    },
    "revenue": {
      "total_revenue": 58750,
      "today_revenue": 2500,
      "week_revenue": 12500,
      "month_revenue": 45000,
      "total_customers": 65
    },
    "popularServices": [
      {
        "service_name": "Overnight Boarding (Standard Room)",
        "booking_count": 45,
        "revenue": 22500
      },
      {
        "service_name": "Day Care",
        "booking_count": 30,
        "revenue": 15000
      }
    ],
    "recentBookings": [
      {
        "booking_id": 123,
        "booking_date": "2024-06-10",
        "status": "confirmed",
        "total_amount": 500,
        "created_at": "2024-06-05T10:30:00Z",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "pet_name": "Max",
        "pet_type": "Dog",
        "service_name": "Overnight Boarding (Standard Room)"
      }
    ]
  }
}
```

### Booking Statistics

Get detailed booking statistics for a specified date range.

**Endpoint:** `GET /api/dashboard/bookings/stats`

**Auth Required:** Admin

**Query Parameters:**
- `startDate`: Start date in YYYY-MM-DD format (required)
- `endDate`: End date in YYYY-MM-DD format (required)

**Response Example:**

```json
{
  "success": true,
  "data": {
    "bookingsByDate": [
      {
        "booking_date": "2024-06-10",
        "total_count": 5,
        "confirmed_count": 4,
        "pending_count": 1,
        "cancelled_count": 0,
        "completed_count": 0,
        "revenue": 2500
      }
    ],
    "bookingsByService": [
      {
        "service_name": "Overnight Boarding (Standard Room)",
        "service_type": "overnight",
        "booking_count": 15,
        "revenue": 7500
      }
    ]
  }
}
```

### Service Availability

Get service availability for the next 30 days.

**Endpoint:** `GET /api/dashboard/services/availability`

**Auth Required:** Admin

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "date": "2024-06-10",
      "isAvailable": true,
      "services": {
        "1": {
          "id": 1,
          "name": "Overnight Boarding (Standard Room)",
          "type": "overnight",
          "maxSlots": 10,
          "bookedSlots": 3,
          "availableSlots": 7
        }
      }
    }
  ]
}
```

### Customer Statistics

Get customer statistics and booking history.

**Endpoint:** `GET /api/dashboard/customers`

**Auth Required:** Admin

**Response Example:**

```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "phone": "+639123456789",
        "booking_count": 5,
        "total_spent": 2500,
        "last_booking_date": "2024-06-10",
        "pet_names": "Max, Bella"
      }
    ],
    "stats": {
      "totalCustomers": 65,
      "repeatCustomers": 35,
      "repeatPercentage": 54,
      "newCustomersLast30Days": 12
    }
  }
}
```

## Email Notifications

The API includes automatic email notifications for the following events:

### Booking Confirmation

When a new booking is created, an email confirmation is sent to the customer with the following details:
- Booking details (date, time, service)
- Pet information
- Total amount
- Special requests (if any)

### Booking Status Updates

When a booking status changes (e.g., from "pending" to "confirmed"), an email notification is sent to the customer with:
- Updated booking status
- Booking details
- Pet information
- Admin notes (if any)

### Email Configuration

Email functionality can be configured using the following environment variables:
- `EMAIL_HOST`: SMTP host (default: smtp.gmail.com)
- `EMAIL_PORT`: SMTP port (default: 587)
- `EMAIL_SECURE`: Whether to use TLS (default: false)
- `EMAIL_USER`: Sender email address
- `EMAIL_PASS`: Email password or app password
- `CONTACT_PHONE`: Business contact phone to include in emails

## Error Handling

### Validation Errors

When validation fails, responses include detailed error information:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "message": "Booking date must be in YYYY-MM-DD format",
      "path": ["bookingDate"]
    },
    {
      "message": "First name is required",
      "path": ["user", "first_name"]
    }
  ]
}
```

### Not Found Errors

When a requested resource is not found:

```json
{
  "success": false,
  "message": "Booking not found"
}
```

### Server Errors

For unexpected server errors:

```json
{
  "success": false,
  "message": "Error fetching bookings"
}
```

In development environments, additional error details may be included.
