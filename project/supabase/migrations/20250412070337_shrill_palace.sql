/*
  # Add consent column to donations table

  1. Changes
    - Add `consent` column to `donations` table with boolean type and NOT NULL constraint
    - Set default value to false for existing records
    
  2. Notes
    - The consent field is required to track user agreement with donation terms
    - Default value ensures data consistency for existing records
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' 
    AND column_name = 'consent'
  ) THEN
    ALTER TABLE donations 
    ADD COLUMN consent boolean NOT NULL DEFAULT false;
  END IF;
END $$;