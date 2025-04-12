/*
  # Add avatar_url to profiles table

  1. Changes
    - Add avatar_url column to profiles table for storing profile picture URLs
    
  2. Notes
    - Column is nullable since not all users will have a profile picture
    - Create storage bucket for avatar images with appropriate policies
*/

-- Add avatar_url column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Create storage bucket for avatars if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'avatars'
  ) THEN
    INSERT INTO storage.buckets (id, name)
    VALUES ('avatars', 'avatars');

    -- Set up storage policies
    CREATE POLICY "Anyone can view avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

    CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'avatars' 
      AND auth.role() = 'authenticated'
    );

    CREATE POLICY "Users can update their own avatar"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'avatars' 
      AND auth.role() = 'authenticated'
    );
  END IF;
END $$;