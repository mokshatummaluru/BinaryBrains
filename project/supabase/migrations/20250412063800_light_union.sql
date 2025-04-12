/*
  # Add INSERT policy for profiles table

  1. Security Changes
    - Add RLS policy to allow authenticated users to insert their own profile
    - Policy ensures users can only create a profile with their own user ID
*/

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);