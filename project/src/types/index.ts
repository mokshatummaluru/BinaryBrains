export type UserRole = 'donor' | 'receiver' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  organization?: string;
  avatar_url?: string;
}

export type DonorType = 'individual' | 'restaurant' | 'caterer' | 'canteen';
export type FoodType = 'veg' | 'non-veg';
export type FoodCategory = 'perishable' | 'non-perishable';

export interface DonationFormData {
  donorType: DonorType;
  foodType: FoodType;
  category: FoodCategory;
  quantity: number;
  description?: string;
  items: string;
  pickupAddress: string;
  location: {
    lat: number;
    lng: number;
  } | null;
  pickupTimeStart: string;
  pickupTimeEnd: string;
  contactPerson?: string;
  contactNumber?: string;
  imageUrl?: string;
  expiryTime: string;
  consent: boolean;
}

export interface Donation extends DonationFormData {
  id: string;
  donorId: string;
  status: 'pending' | 'accepted' | 'picked' | 'verified';
  createdAt: string;
}