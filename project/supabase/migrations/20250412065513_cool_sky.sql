/*
  # Create donations table and related schemas

  1. New Tables
    - `donations`
      - `id` (uuid, primary key)
      - `donor_id` (uuid, references profiles)
      - `donor_type` (enum)
      - `food_type` (enum)
      - `category` (enum)
      - `quantity` (numeric)
      - `description` (text)
      - `pickup_address` (text)
      - `location` (point)
      - `pickup_time_start` (time)
      - `pickup_time_end` (time)
      - `contact_person` (text)
      - `contact_number` (text)
      - `image_url` (text)
      - `expiry_time` (timestamp)
      - `status` (enum)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on donations table
    - Add policies for CRUD operations
*/

-- Create enum types
CREATE TYPE donor_type AS ENUM ('individual', 'restaurant', 'caterer', 'canteen');
CREATE TYPE food_type AS ENUM ('veg', 'non-veg');
CREATE TYPE food_category AS ENUM ('perishable', 'non-perishable');
CREATE TYPE donation_status AS ENUM ('pending', 'accepted', 'picked', 'verified');

-- Create donations table
CREATE TABLE donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid REFERENCES profiles(id) NOT NULL,
  donor_type donor_type NOT NULL,
  food_type food_type NOT NULL,
  category food_category NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  description text,
  pickup_address text NOT NULL,
  location point NOT NULL,
  pickup_time_start time NOT NULL,
  pickup_time_end time NOT NULL,
  contact_person text,
  contact_number text,
  image_url text,
  expiry_time timestamp with time zone NOT NULL,
  status donation_status NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Donors can create their own donations"
  ON donations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "Donors can view their own donations"
  ON donations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = donor_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'receiver'
  );

CREATE POLICY "Donors can update their own pending donations"
  ON donations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = donor_id AND status = 'pending')
  WITH CHECK (auth.uid() = donor_id AND status = 'pending');

-- Create indexes
CREATE INDEX donations_donor_id_idx ON donations(donor_id);
CREATE INDEX donations_status_idx ON donations(status);
CREATE INDEX donations_location_idx ON donations USING GIST(location);

-- Create storage bucket for donation images
INSERT INTO storage.buckets (id, name)
VALUES ('donation-images', 'donation-images')
ON CONFLICT DO NOTHING;

-- Set up storage policy
CREATE POLICY "Anyone can view donation images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'donation-images');

CREATE POLICY "Authenticated users can upload donation images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'donation-images');