import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Package, Clock, Pencil, Trash2 } from 'lucide-react';
import DonationForm from '../components/DonationForm';
import { supabase } from '../lib/supabase';
import type { Donation } from '../types';

const DonorDashboard = () => {
  const [showDonationForm, setShowDonationForm] = useState(false);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);

  useEffect(() => {
    fetchDonations();
  }, []);

  const fetchDonations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .eq('donor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDonations(data || []);
    } catch (error) {
      console.error('Error fetching donations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (donationId: string) => {
    if (!window.confirm('Are you sure you want to delete this donation? This action cannot be undone.')) {
      return;
    }

    try {
      // Get the donation details first
      const donation = donations.find(d => d.id === donationId);
      if (!donation) return;

      // Delete the donation from the database
      const { error: deleteError } = await supabase
        .from('donations')
        .delete()
        .eq('id', donationId)
        .eq('status', 'pending'); // Only allow deletion of pending donations

      if (deleteError) throw deleteError;

      // If the donation had an image and it's not a full URL, delete it from storage
      if (donation.image_url && !donation.image_url.startsWith('http')) {
        const { error: storageError } = await supabase.storage
          .from('donation-images')
          .remove([donation.image_url]);

        if (storageError) {
          console.error('Error deleting image:', storageError);
        }
      }

      // Remove the donation from the local state
      setDonations(donations.filter(d => d.id !== donationId));
    } catch (error) {
      console.error('Error deleting donation:', error);
      alert('Failed to delete donation. Please try again.');
    }
  };

  const getImageUrl = (donation: Donation) => {
    if (!donation.image_url) return null;
    
    if (donation.image_url.startsWith('http')) {
      return donation.image_url;
    }
    
    return supabase.storage
      .from('donation-images')
      .getPublicUrl(donation.image_url)
      .data.publicUrl;
  };

  const formatExpiryTime = (expiryTime: string) => {
    const expiry = new Date(expiryTime);
    const now = new Date();
    const diffHours = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 0) {
      return 'Expired';
    } else if (diffHours < 1) {
      return 'Expiring soon';
    } else if (diffHours < 24) {
      return `Expires in ${diffHours} hours`;
    } else {
      return `Expires in ${Math.round(diffHours / 24)} days`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'picked':
        return 'bg-green-100 text-green-800';
      case 'verified':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Donor Dashboard
          </h2>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            type="button"
            onClick={() => setShowDonationForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Create New Donation
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 text-center text-gray-500">Loading donations...</div>
      ) : donations.length === 0 ? (
        <div className="mt-8 text-center text-gray-500">No donations yet. Create your first donation!</div>
      ) : (
        <div className="mt-8 grid gap-5 max-w-lg mx-auto lg:grid-cols-3 lg:max-w-none">
          {donations.map((donation) => (
            <div key={donation.id} className="flex flex-col rounded-lg shadow-lg overflow-hidden">
              <div className="flex-shrink-0 relative h-48">
                <img
                  className="absolute inset-0 h-full w-full object-cover"
                  src={getImageUrl(donation)}
                  alt="Food donation"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=1000';
                  }}
                />
                {donation.status === 'pending' && (
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      onClick={() => setEditingDonation(donation)}
                      className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                      title="Edit donation"
                    >
                      <Pencil className="h-4 w-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(donation.id)}
                      className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                      title="Delete donation"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 bg-white p-6 flex flex-col justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-green-600">
                      {donation.donor_type.charAt(0).toUpperCase() + donation.donor_type.slice(1)}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(donation.status)}`}>
                      {donation.status.charAt(0).toUpperCase() + donation.status.slice(1)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center">
                    <Package className="h-5 w-5 text-gray-400" />
                    <p className="ml-2 text-xl font-semibold text-gray-900">
                      {donation.items || 'Mixed Items'}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center text-sm text-gray-500">
                    <MapPin className="h-4 w-4" />
                    <span className="ml-1 truncate">{donation.pickup_address}</span>
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span className="ml-1">{formatExpiryTime(donation.expiry_time)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showDonationForm || editingDonation) && (
        <DonationForm 
          donation={editingDonation}
          onClose={() => {
            setShowDonationForm(false);
            setEditingDonation(null);
            fetchDonations();
          }} 
        />
      )}
    </div>
  );
};

export default DonorDashboard;