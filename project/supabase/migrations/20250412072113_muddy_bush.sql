/*
  # Fix donations table schema

  1. Changes
    - Ensure all required columns exist with proper types
    - Add missing columns: contact_number, contact_person, items, consent
    - Fix location column type to properly handle point data
    - Set up storage bucket and policies for donation images

  2. Security
    - Maintain existing RLS policies
    - Add storage policies for donation images
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

  -- Add contact_person if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' 
    AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE donations ADD COLUMN contact_person text;
  END IF;

  -- Add items field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' 
    AND column_name = 'items'
  ) THEN
    ALTER TABLE donations ADD COLUMN items text;
  END IF;

  -- Add consent field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' 
    AND column_name = 'consent'
  ) THEN
    ALTER TABLE donations ADD COLUMN consent boolean NOT NULL DEFAULT false;
  END IF;

  -- Ensure location column is of type point
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' 
    AND column_name = 'location'
    AND data_type != 'point'
  ) THEN
    ALTER TABLE donations ALTER COLUMN location TYPE point USING location::point;
  END IF;
END $$;

-- Set up storage bucket for donation images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'donation-images'
  ) THEN
    INSERT INTO storage.buckets (id, name)
    VALUES ('donation-images', 'donation-images');

    -- Set up storage policies
    CREATE POLICY "Anyone can view donation images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'donation-images');

    CREATE POLICY "Authenticated users can upload donation images"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'donation-images' 
      AND auth.role() = 'authenticated'
    );
  END IF;
END $$;