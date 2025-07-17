-- Migration: Treat cats the same as dogs for overnight and daycare bookings
-- Objective: For any existing cat bookings linked to an overnight or daycare
-- service, recalculate the weight_category based on the pet's weight so that
-- they fall into the standard Small/Medium/Large/X-Large brackets instead of
-- the special "Cat" category.  Grooming bookings remain unchanged so that the
-- Cat rate can still be used there.

-- 1. Backup (safety first)
CREATE TABLE IF NOT EXISTS bookings_backup_cats AS
SELECT * FROM bookings;

-- 2. Recompute weight_category for the affected bookings
UPDATE bookings AS b
JOIN pets     AS p ON b.pet_id     = p.pet_id
JOIN services AS s ON b.service_id = s.service_id
SET b.weight_category = CASE
    WHEN p.weight IS NULL OR p.weight <= 9  THEN 'Small'
    WHEN p.weight <= 25 THEN 'Medium'
    WHEN p.weight <= 40 THEN 'Large'
    ELSE 'X-Large'
END
WHERE p.pet_type = 'Cat'
  AND s.service_type IN ('overnight', 'daycare');

-- 3. (Optional) If you want to immediately refresh the stored total_amount
--    you can uncomment and adapt the block below, or leave pricing recalculation
--    to the application layer.
--
-- UPDATE bookings AS b
-- JOIN services AS s ON b.service_id = s.service_id
-- SET b.total_amount = CASE b.weight_category
--     WHEN 'Small'  THEN s.price_small
--     WHEN 'Medium' THEN s.price_medium
--     WHEN 'Large'  THEN s.price_large
--     WHEN 'X-Large' THEN s.price_xlarge
-- END
-- WHERE b.pet_type = 'Cat' AND s.service_type IN ('overnight', 'daycare');

-- Done.
