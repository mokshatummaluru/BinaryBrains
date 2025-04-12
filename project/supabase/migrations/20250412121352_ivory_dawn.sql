/*
  # Admin Panel Schema Updates

  1. New Tables
    - `metrics`
      - Daily metrics for food saved, people served, and emissions
    - `reports`
      - User reports and flagged content
    - `organizations`
      - Verified NGOs and volunteer organizations

  2. Updates
    - Add verification status to profiles
    - Add metrics calculations
    - Add reporting system
*/

-- Add verification status to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_date timestamptz,
ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES profiles(id);

-- Create metrics table for daily statistics
CREATE TABLE IF NOT EXISTS metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  food_saved_kg numeric NOT NULL DEFAULT 0,
  people_served integer NOT NULL DEFAULT 0,
  emissions_prevented_kg numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create reports table for flagged content
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES profiles(id) NOT NULL,
  reported_user_id uuid REFERENCES profiles(id),
  donation_id uuid REFERENCES donations(id),
  report_type text NOT NULL CHECK (report_type IN ('user', 'donation')),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  notes text
);

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('ngo', 'volunteer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  contact_person text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  registration_number text,
  documents_url text[],
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Create policies for metrics
CREATE POLICY "Admins can manage metrics"
  ON metrics
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Create policies for reports
CREATE POLICY "Users can create reports"
  ON reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can manage reports"
  ON reports
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view their own reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- Create policies for organizations
CREATE POLICY "Anyone can view approved organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (status = 'approved');

CREATE POLICY "Admins can manage organizations"
  ON organizations
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Create function to calculate CO2 emissions prevented
CREATE OR REPLACE FUNCTION calculate_emissions_prevented(food_weight_kg numeric)
RETURNS numeric AS $$
BEGIN
  -- Average CO2 equivalent per kg of food waste (simplified calculation)
  RETURN food_weight_kg * 2.5; -- 2.5 kg CO2 per kg of food waste
END;
$$ LANGUAGE plpgsql;