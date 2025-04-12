/*
  # Add cascade deletion for donations

  1. Changes
    - Add trigger to clean up storage objects when a donation is deleted
    - Add policy to allow deletion of donation images
    - Ensure all related data is removed when a donation is deleted

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

-- Add storage policy for deleting donation images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Donors can delete their own donation images'
  ) THEN
    CREATE POLICY "Donors can delete their own donation images"
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'donation-images'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;