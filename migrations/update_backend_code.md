# Backend Code Update Guide

This document outlines the changes needed in the backend code to support the database schema change from `check_in_date`/`check_out_date` to `start_date`/`end_date`.

## Database Schema Changes

The database schema has been updated in `schema.sql` to use `start_date` and `end_date` instead of `check_in_date` and `check_out_date`.

## Migration Script

A migration script `rename_date_columns.sql` has been created to:
1. Create a backup of the bookings table
2. Add new columns `start_date` and `end_date`
3. Copy data from old columns to new columns
4. Drop the old columns

## Backend Code Changes

The following files have been updated to use the new column names:

1. **models/booking.js**
   - Updated the `createBooking` function to use `start_date` and `end_date` instead of `check_in_date` and `check_out_date`
   - Updated the returned booking data to include `start_date` and `end_date`

## Frontend-Backend Integration

The frontend code uses `startDate` and `endDate` (camelCase), while the backend database now uses `start_date` and `end_date` (snake_case). The BookingContext.js file has been updated to map between these naming conventions.

## Testing

After applying these changes, you should test:
1. Creating new bookings
2. Viewing existing bookings
3. Filtering bookings by date
4. Dashboard reports that use booking dates

## Rollback Plan

If issues arise:
1. Restore the bookings table from the backup created during migration
2. Revert the schema.sql changes
3. Revert the backend code changes
