import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { supabase } from '../lib/supabase';
import { Clock, MapPin, AlertCircle } from 'lucide-react';
import type { Donation } from '../types';

interface MarkerInfo {
  marker: google.maps.Marker;
  infoWindow: google.maps.InfoWindow;
}

const GeoMapDashboard = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerInfo>>(new Map());
  const [donations, setDonations] = useState<Donation[]>([]);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [userLocation, setUserLocation] = useState<google.maps.LatLng | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isRetryingLocation, setIsRetryingLocation] = useState(false);

  // Default location (Singapore)
  const DEFAULT_LOCATION = { lat: 1.3521, lng: 103.8198 };

  const getMarkerIcon = (donation: Donation) => {
    const expiryTime = new Date(donation.expiry_time);
    const now = new Date();
    const hoursUntilExpiry = (expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (donation.status !== 'pending') {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#6B7280',
        fillOpacity: 0.7,
        strokeWeight: 2,
        strokeColor: '#4B5563',
      };
    } else if (hoursUntilExpiry <= 2) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#EF4444',
        fillOpacity: 0.7,
        strokeWeight: 2,
        strokeColor: '#B91C1C',
      };
    } else {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#10B981',
        fillOpacity: 0.7,
        strokeWeight: 2,
        strokeColor: '#059669',
      };
    }
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

  const createInfoWindowContent = (donation: Donation) => {
    return `
      <div class="p-4 max-w-sm">
        <h3 class="font-semibold text-lg mb-2">${donation.items || 'Mixed Items'}</h3>
        <p class="text-sm text-gray-600 mb-2">${donation.description || ''}</p>
        <div class="flex items-center text-sm text-gray-500 mb-1">
          <span class="mr-2">📍</span>
          ${donation.pickup_address}
        </div>
        <div class="flex items-center text-sm ${
          new Date(donation.expiry_time) < new Date() ? 'text-red-500' : 'text-gray-500'
        }">
          <span class="mr-2">⏰</span>
          ${formatExpiryTime(donation.expiry_time)}
        </div>
        <button
          onclick="window.showDirections('${donation.id}')"
          class="mt-3 w-full bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
        >
          Show Directions
        </button>
      </div>
    `;
  };

  const fetchDonations = async () => {
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDonations(data || []);
    } catch (error) {
      console.error('Error fetching donations:', error);
    }
  };

  const showDirections = async (donationId: string) => {
    const donation = donations.find(d => d.id === donationId);
    if (!donation || !userLocation || !googleMapRef.current || !directionsRenderer) {
      setMapError('Unable to show directions. Please ensure location access is enabled.');
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    
    const pointMatch = donation.location.match(/\((.+),(.+)\)/);
    if (!pointMatch) return;
    
    const [, lng, lat] = pointMatch;
    const destination = new google.maps.LatLng(parseFloat(lat), parseFloat(lng));

    try {
      const result = await directionsService.route({
        origin: userLocation,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      directionsRenderer.setDirections(result);
      setSelectedDonation(donation);
      setMapError(null);
    } catch (error) {
      console.error('Error fetching directions:', error);
      setMapError('Unable to calculate directions. Please try again.');
    }
  };

  const getUserLocation = (map: google.maps.Map) => {
    if (!navigator.geolocation) {
      setMapError('Geolocation is not supported by your browser. Please adjust the map manually.');
      const defaultPos = new google.maps.LatLng(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng);
      setUserLocation(defaultPos);
      map.setCenter(defaultPos);
      return;
    }

    setIsRetryingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = new google.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude
        );
        setUserLocation(pos);
        map.setCenter(pos);
        setMapError(null);
        setIsRetryingLocation(false);

        new google.maps.Marker({
          position: pos,
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#4F46E5',
            fillOpacity: 0.4,
            strokeWeight: 0.4,
          },
          title: 'Your Location',
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Unable to determine your location. ';
        
        switch (error.code) {
          case GeolocationPositionError.PERMISSION_DENIED:
            errorMessage += 'Please enable location access in your browser settings.';
            break;
          case GeolocationPositionError.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.';
            break;
          case GeolocationPositionError.TIMEOUT:
            errorMessage += 'Location request timed out.';
            break;
          default:
            errorMessage += 'Please enable location access or adjust the map manually.';
        }
        
        setMapError(errorMessage);
        setIsRetryingLocation(false);
        
        // Set default location and update user location state
        const defaultPos = new google.maps.LatLng(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng);
        setUserLocation(defaultPos);
        map.setCenter(defaultPos);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    (window as any).showDirections = showDirections;
  }, [donations, userLocation]);

  useEffect(() => {
    const initMap = async () => {
      const loader = new Loader({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places', 'routes'],
      });

      try {
        const google = await loader.load();
        
        if (!mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: DEFAULT_LOCATION,
          zoom: 12,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });

        googleMapRef.current = map;

        const renderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: true,
        });
        setDirectionsRenderer(renderer);

        getUserLocation(map);
        fetchDonations();
      } catch (error: any) {
        console.error('Error loading Google Maps:', error);
        if (error.message?.includes('BillingNotEnabled')) {
          setMapError('Google Maps is currently unavailable. Please try again later.');
        } else {
          setMapError('Unable to load the map. Please refresh the page or try again later.');
        }
      }
    };

    initMap();

    const donationsSubscription = supabase
      .channel('donations_channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'donations' 
      }, () => {
        fetchDonations();
      })
      .subscribe();

    return () => {
      donationsSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!googleMapRef.current) return;

    markersRef.current.forEach((markerInfo) => {
      markerInfo.marker.setMap(null);
      markerInfo.infoWindow.close();
    });
    markersRef.current.clear();

    donations.forEach((donation) => {
      const pointMatch = donation.location.match(/\((.+),(.+)\)/);
      if (!pointMatch) return;
      
      const [, lng, lat] = pointMatch;
      const position = new google.maps.LatLng(parseFloat(lat), parseFloat(lng));

      const marker = new google.maps.Marker({
        position,
        map: googleMapRef.current!,
        icon: getMarkerIcon(donation),
        title: donation.items || 'Food Donation',
      });

      const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(donation),
      });

      marker.addListener('click', () => {
        markersRef.current.forEach((mi) => mi.infoWindow.close());
        infoWindow.open(googleMapRef.current!, marker);
      });

      markersRef.current.set(donation.id, { marker, infoWindow });
    });
  }, [donations]);

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Error Message */}
      {mapError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-md flex items-center max-w-md">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm">{mapError}</p>
            {!isRetryingLocation && (
              <button
                onClick={() => getUserLocation(googleMapRef.current!)}
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-800 underline"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-md">
        <h3 className="font-semibold mb-2">Map Legend</h3>
        <div className="space-y-2">
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-green-500 mr-2"></span>
            <span>Fresh & Available</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-red-500 mr-2"></span>
            <span>Near Expiry</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-gray-500 mr-2"></span>
            <span>Picked/Expired</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-indigo-400 mr-2"></span>
            <span>Your Location</span>
          </div>
        </div>
      </div>

      {/* Selected Donation Info */}
      {selectedDonation && (
        <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-md max-w-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold">{selectedDonation.items || 'Mixed Items'}</h3>
            <button
              onClick={() => {
                setSelectedDonation(null);
                directionsRenderer?.setDirections(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">{selectedDonation.description}</p>
            <div className="flex items-center text-gray-500">
              <MapPin className="h-4 w-4 mr-1" />
              <span>{selectedDonation.pickup_address}</span>
            </div>
            <div className="flex items-center text-gray-500">
              <Clock className="h-4 w-4 mr-1" />
              <span>{formatExpiryTime(selectedDonation.expiry_time)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeoMapDashboard;