import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DonorDashboard from './pages/DonorDashboard';
import ReceiverDashboard from './pages/ReceiverDashboard';
import GeoMapDashboard from './pages/GeoMapDashboard';
import AdminDashboard from './pages/AdminDashboard';

const AuthRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'donor') {
          navigate('/donor');
        } else if (profile?.role === 'receiver') {
          navigate('/receiver');
        } else if (profile?.role === 'admin') {
          navigate('/admin');
        }
      }
    };

    checkAuth();
  }, [navigate]);

  return null;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<><AuthRedirect /><Home /></>} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/donor" element={<DonorDashboard />} />
          <Route path="/receiver" element={<ReceiverDashboard />} />
          <Route path="/map" element={<GeoMapDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;