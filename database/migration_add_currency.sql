-- ==============================================================
-- SmartTrip Database Migration
-- Adds currency column to trip table and defaults existing rows to INR
-- ==============================================================

-- 1. Add currency column if it does not already exist
ALTER TABLE trip ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';

-- 2. Populate any NULL or blank currency records with default INR
UPDATE trip SET currency = 'INR' WHERE currency IS NULL OR currency = '';
