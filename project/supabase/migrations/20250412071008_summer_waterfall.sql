/*
  # Update donations table schema

  1. Changes
    - Add `contact_number` column for donor contact information
    - Add `items` column for food item categorization
    - Create storage bucket for donation images
    
  2. Notes
    - Items field allows comma-separated values for easy filtering
    - Storage bucket includes security policies
*/

-- Add contact_number if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' 
    AND column_name = 'contact_number'
  ) THEN
    ALTER TABLE donations 
    ADD COLUMN contact_number text;
  END IF;
END $$;

-- Add items field if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' 
    AND column_name = 'items'
  ) THEN
    ALTER TABLE donations 
    ADD COLUMN items text;
  END IF;
END $$;

-- Create storage bucket for donation images if it doesn't exist
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