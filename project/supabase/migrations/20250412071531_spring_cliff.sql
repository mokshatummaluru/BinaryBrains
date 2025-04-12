/*
  # Add contact fields to donations table

  1. Changes
    - Add `contact_number` column to `donations` table
    - Add `contact_person` column to `donations` table (if missing)
    - Both columns are nullable text fields since contact information might not always be required

  2. Security
    - No changes to RLS policies needed as these are just additional fields
    - Existing row-level security policies will continue to protect this data
*/

DO $$ 
BEGIN
  -- Add contact_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' 
    AND column_name = 'contact_number'
  ) THEN
    ALTER TABLE donations ADD COLUMN contact_number text;
  END IF;

  -- Add contact_person if it doesn't exist (for completeness)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' 
    AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE donations ADD COLUMN contact_person text;
  END IF;
END $$;