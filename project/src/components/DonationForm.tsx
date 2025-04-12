import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MapPin, Clock, Upload } from 'lucide-react';
import type { DonationFormData, DonorType, FoodType, FoodCategory, Donation } from '../types';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=1000';

interface DonationFormProps {
  donation?: Donation | null;
  onClose: () => void;
}

const DonationForm: React.FC<DonationFormProps> = ({ donation, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [formData, setFormData] = useState<DonationFormData>({
    donorType: donation?.donor_type || 'individual',
    foodType: donation?.food_type || 'veg',
    category: donation?.category || 'perishable',
    quantity: donation?.quantity || 0,
    description: donation?.description || '',
    items: donation?.items || '',
    pickupAddress: donation?.pickup_address || '',
    location: donation?.location || null,
    pickupTimeStart: donation?.pickup_time_start || '',
    pickupTimeEnd: donation?.pickup_time_end || '',
    contactPerson: donation?.contact_person || '',
    contactNumber: donation?.contact_number || '',
    imageUrl: donation?.image_url || DEFAULT_IMAGE,
    expiryTime: donation?.expiry_time || '',
    consent: donation?.consent || false,
  });

  useEffect(() => {
    // Set initial image preview if editing an existing donation
    if (donation?.image_url) {
      const imageUrl = donation.image_url.startsWith('http') 
        ? donation.image_url 
        : supabase.storage.from('donation-images').getPublicUrl(donation.image_url).data.publicUrl;
      setImagePreview(imageUrl);
      setUploadedFileName(donation.image_url);
    }

    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setUserProfile(profile);
        
        // Only update contact info if this is a new donation
        if (!donation) {
          setFormData(prev => ({
            ...prev,
            contactPerson: profile?.name || '',
            contactNumber: profile?.phone || '',
          }));
        }
      }
    };

    // Get user's current location with timeout
    if (navigator.geolocation && !donation?.location) {
      const locationTimeout = setTimeout(() => {
        setLocationError('Location request timed out. Please enter your address manually.');
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(locationTimeout);
          const { latitude: lat, longitude: lng } = position.coords;
          setCurrentLocation({ lat, lng });
          setFormData(prev => ({
            ...prev,
            location: { lat, lng },
          }));
          setLocationError(null);
        },
        (error) => {
          clearTimeout(locationTimeout);
          let errorMessage = 'Unable to get your location. Please enter your address manually.';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access was denied. Please enter your address manually.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable. Please enter your address manually.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please enter your address manually.';
              break;
          }
          
          setLocationError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }

    fetchUserProfile();
  }, [donation]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      
      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data, error: uploadError } = await supabase.storage
        .from('donation-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setUploadedFileName(fileName);
      setFormData(prev => ({ ...prev, imageUrl: fileName }));
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.location && !formData.pickupAddress) {
      setError('Please provide either your location or a pickup address');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if location has valid coordinates before constructing the point string
      const locationPoint = formData.location?.lat && formData.location?.lng
        ? `(${formData.location.lng},${formData.location.lat})`
        : '(0,0)'; // Default to origin if no valid coordinates

      const donationData = {
        donor_id: user.id,
        donor_type: formData.donorType,
        food_type: formData.foodType,
        category: formData.category,
        quantity: formData.quantity,
        description: formData.description,
        items: formData.items,
        pickup_address: formData.pickupAddress,
        location: locationPoint,
        pickup_time_start: formData.pickupTimeStart,
        pickup_time_end: formData.pickupTimeEnd,
        contact_person: formData.contactPerson,
        contact_number: formData.contactNumber,
        image_url: uploadedFileName || formData.imageUrl,
        expiry_time: formData.expiryTime,
        consent: formData.consent,
        status: 'pending',
      };

      if (donation) {
        // Update existing donation
        const { error: updateError } = await supabase
          .from('donations')
          .update(donationData)
          .eq('id', donation.id)
          .eq('status', 'pending'); // Only allow updating pending donations

        if (updateError) throw updateError;
      } else {
        // Create new donation
        const { error: insertError } = await supabase
          .from('donations')
          .insert([donationData]);

        if (insertError) throw insertError;
      }

      onClose();
    } catch (err) {
      console.error('Error saving donation:', err);
      setError(err instanceof Error ? err.message : 'Failed to save donation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-6 border w-full max-w-4xl shadow-2xl rounded-xl bg-white mb-8">
        <div className="flex justify-between items-center pb-4 border-b">
          <h3 className="text-2xl font-bold text-gray-900">
            {donation ? 'Edit Donation' : 'Create New Donation'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Basic Info Section */}
          <section className="space-y-6">
            <h4 className="text-lg font-semibold text-gray-900 pb-2 border-b">Basic Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Donor Type
                </label>
                <select
                  value={formData.donorType}
                  onChange={(e) => setFormData({ ...formData, donorType: e.target.value as DonorType })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                >
                  <option value="individual">Individual</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="caterer">Caterer</option>
                  <option value="canteen">Canteen</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Food Type
                </label>
                <select
                  value={formData.foodType}
                  onChange={(e) => setFormData({ ...formData, foodType: e.target.value as FoodType })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                >
                  <option value="veg">Vegetarian</option>
                  <option value="non-veg">Non-Vegetarian</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as FoodCategory })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                >
                  <option value="perishable">Perishable</option>
                  <option value="non-perishable">Non-Perishable</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Food Items (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.items}
                  onChange={(e) => setFormData({ ...formData, items: e.target.value })}
                  placeholder="e.g., rice, curry, vegetables"
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Quantity (kg or meals)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Food Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  placeholder="E.g., Leftover rice and curry for 15 people"
                />
              </div>
            </div>
          </section>

          {/* Pickup Details Section */}
          <section className="space-y-6">
            <h4 className="text-lg font-semibold text-gray-900 pb-2 border-b">Pickup Details</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.pickupAddress}
                    onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 pl-4 pr-10"
                    placeholder={locationError ? "Please enter your address manually" : ""}
                  />
                  <MapPin className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
                {locationError && (
                  <p className="mt-2 text-sm text-amber-600">
                    {locationError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Time Start
                </label>
                <input
                  type="time"
                  value={formData.pickupTimeStart}
                  onChange={(e) => setFormData({ ...formData, pickupTimeStart: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Time End
                </label>
                <input
                  type="time"
                  value={formData.pickupTimeEnd}
                  onChange={(e) => setFormData({ ...formData, pickupTimeEnd: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Best Before (Expiry Time)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiryTime}
                  onChange={(e) => setFormData({ ...formData, expiryTime: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>
            </div>
          </section>

          {/* Contact Details Section */}
          <section className="space-y-6">
            <h4 className="text-lg font-semibold text-gray-900 pb-2 border-b">Contact Details</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Number
                </label>
                <input
                  type="tel"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>
            </div>
          </section>

          {/* Image Upload Section */}
          <section className="space-y-6">
            <h4 className="text-lg font-semibold text-gray-900 pb-2 border-b">Food Image</h4>
            
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-green-500 transition-colors">
              <div className="space-y-1 text-center">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="mx-auto h-40 w-40 object-cover rounded-lg shadow-md"
                  />
                ) : (
                  <Camera className="mx-auto h-12 w-12 text-gray-400" />
                )}
                <div className="flex text-sm text-gray-600">
                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500">
                    <span>Upload a file</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageUpload}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
              </div>
            </div>
          </section>

          {/* Consent Section */}
          <section className="space-y-6">
            <div className="flex items-start space-x-3">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  checked={formData.consent}
                  onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                  className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
              </div>
              <div className="flex-grow">
                <label className="font-medium text-gray-700">
                  Declaration
                </label>
                <p className="text-sm text-gray-500">
                  I confirm this food is safe to consume, packed hygienically, and I agree to allow pickup by an NGO/volunteer.
                </p>
              </div>
            </div>
          </section>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.consent || loading}
              className="px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : donation ? 'Save Changes' : 'Create Donation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DonationForm;