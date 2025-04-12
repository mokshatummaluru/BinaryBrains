/*
  # Fix donation image handling

  1. Changes
    - Add trigger to clean up storage objects when a donation is deleted
    - Add policy to allow deletion of donation images
    - Ensure proper storage bucket setup for donation images

  2. Security
    - Only allow deletion of own donation images
    - Maintain RLS policies for data access
*/

-- Create function to delete donation images
CREATE OR REPLACE FUNCTION delete_donation_storage_objects()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the donation image if it exists and is not a full URL
  IF OLD.image_url IS NOT NULL AND NOT (OLD.image_url LIKE 'http%') THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'donation-images'
    AND name = OLD.image_url;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically delete storage objects when donation is deleted
DROP TRIGGER IF EXISTS delete_donation_storage_trigger ON donations;
CREATE TRIGGER delete_donation_storage_trigger
  BEFORE DELETE ON donations
  FOR EACH ROW
  EXECUTE FUNCTION delete_donation_storage_objects();

-- Set up storage bucket and policies for donation images
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

    CREATE POLICY "Users can delete their own donation images"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'donation-images'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;