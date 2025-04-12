import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Package, Search, Filter, MapIcon, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Donation } from '../types';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop';

const ReceiverDashboard = () => {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    donorType: '',
    foodType: '',
    category: '',
  });

  const fetchDonations = async () => {
    try {
      const { data, error } = await supabase
        .from('donations')
        .select(`
          *,
          profiles (
            name,
            organization
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDonations(data || []);
    } catch (error) {
      console.error('Error fetching donations:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAuthorization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'receiver') {
        navigate('/');
        return;
      }

      setIsAuthorized(true);
    } catch (error) {
      console.error('Authorization error:', error);
      navigate('/login');
    }
  };

  useEffect(() => {
    checkAuthorization();
  }, []);

  useEffect(() => {
    fetchDonations();
  }, []);

  if (!isAuthorized) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

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

  const handleAcceptDonation = async (donationId: string) => {
    try {
      const { error } = await supabase
        .from('donations')
        .update({ status: 'accepted' })
        .eq('id', donationId);

      if (error) throw error;
      
      // Refresh donations list
      fetchDonations();
    } catch (error) {
      console.error('Error accepting donation:', error);
    }
  };

  const getImageUrl = (donation: any) => {
    if (!donation.image_url) return DEFAULT_IMAGE;
    
    if (donation.image_url.startsWith('http')) {
      return donation.image_url;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('donation-images')
      .getPublicUrl(donation.image_url);
    
    return publicUrl;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== '').length;
  };

  const filteredDonations = donations.filter(donation => {
    const searchMatch = 
      donation.items?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      donation.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      donation.pickup_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (donation.profiles?.organization || '').toLowerCase().includes(searchTerm.toLowerCase());

    const typeMatch = !filters.donorType || donation.donor_type === filters.donorType;
    const foodTypeMatch = !filters.foodType || donation.food_type === filters.foodType;
    const categoryMatch = !filters.category || donation.category === filters.category;

    return searchMatch && typeMatch && foodTypeMatch && categoryMatch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Available Donations
          </h2>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <Link
            to="/map"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <MapIcon className="h-4 w-4 mr-2" />
            View Map
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex gap-2">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by items, description, location, or organization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-12 pl-12 pr-4 text-lg rounded-lg border-2 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors duration-200"
              />
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </form>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center px-4 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors relative"
          >
            <Filter className="h-5 w-5 mr-2" />
            Filters
            {getActiveFiltersCount() > 0 && (
              <span className="absolute -top-2 -right-2 bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {getActiveFiltersCount()}
              </span>
            )}
          </button>
        </div>

        {/* Filter Popup */}
        {showFilters && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Donor Type
                  </label>
                  <select
                    value={filters.donorType}
                    onChange={(e) => setFilters({ ...filters, donorType: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  >
                    <option value="">All Donor Types</option>
                    <option value="individual">Individual</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="caterer">Caterer</option>
                    <option value="canteen">Canteen</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Food Type
                  </label>
                  <select
                    value={filters.foodType}
                    onChange={(e) => setFilters({ ...filters, foodType: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  >
                    <option value="">All Food Types</option>
                    <option value="veg">Vegetarian</option>
                    <option value="non-veg">Non-Vegetarian</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  >
                    <option value="">All Categories</option>
                    <option value="perishable">Perishable</option>
                    <option value="non-perishable">Non-Perishable</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setFilters({
                      donorType: '',
                      foodType: '',
                      category: '',
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Donations Grid */}
        {loading ? (
          <div className="text-center text-gray-500">Loading donations...</div>
        ) : filteredDonations.length === 0 ? (
          <div className="text-center text-gray-500">No donations available</div>
        ) : (
          <div className="grid gap-5 mt-8 lg:grid-cols-3">
            {filteredDonations.map((donation) => (
              <div key={donation.id} className="flex flex-col rounded-lg shadow-lg overflow-hidden">
                <div className="flex-shrink-0 relative h-48">
                  <img
                    className="absolute inset-0 h-full w-full object-cover"
                    src={getImageUrl(donation)}
                    alt="Food donation"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = DEFAULT_IMAGE;
                    }}
                  />
                </div>
                <div className="flex-1 bg-white p-6 flex flex-col justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-green-600">
                        {donation.profiles?.organization || donation.profiles?.name}
                      </p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {donation.donor_type.charAt(0).toUpperCase() + donation.donor_type.slice(1)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xl font-semibold text-gray-900">
                        {donation.items || 'Mixed Items'}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {donation.description}
                      </p>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="truncate">{donation.pickup_address}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{formatExpiryTime(donation.expiry_time)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={() => handleAcceptDonation(donation.id)}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Accept Donation
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiverDashboard;