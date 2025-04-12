import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogIn, AlertCircle } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            // Profile not found - sign out the user and redirect to signup
            await supabase.auth.signOut();
            setError('Your profile is incomplete. Please sign up to complete your registration.');
            return;
          }
          throw profileError;
        }

        if (profile?.role === 'donor') {
          navigate('/donor');
        } else if (profile?.role === 'receiver') {
          navigate('/receiver');
        } else {
          // If role is not set or invalid, sign out and show error
          await supabase.auth.signOut();
          setError('Invalid user role. Please contact support.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred sending reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {resetPasswordMode ? 'Reset your password' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {resetPasswordMode ? (
              <button
                onClick={() => setResetPasswordMode(false)}
                className="font-medium text-green-600 hover:text-green-500"
              >
                Back to login
              </button>
            ) : (
              <>
                Or{' '}
                <Link to="/signup" className="font-medium text-green-600 hover:text-green-500">
                  create a new account
                </Link>
              </>
            )}
          </p>
        </div>

        {resetSent ? (
          <div className="bg-green-50 p-4 rounded-md text-green-700">
            Check your email for password reset instructions.
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={resetPasswordMode ? handleResetPassword : handleLogin}>
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-md">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
                {error.includes('incomplete') && (
                  <Link to="/signup" className="ml-2 font-medium text-green-600 hover:text-green-500">
                    Complete signup
                  </Link>
                )}
              </div>
            )}
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                />
              </div>
              {!resetPasswordMode && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                  />
                </div>
              )}
            </div>

            {!resetPasswordMode && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setResetPasswordMode(true)}
                  className="text-sm font-medium text-green-600 hover:text-green-500"
                >
                  Forgot your password?
                </button>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <LogIn className="h-5 w-5 text-green-500 group-hover:text-green-400" />
                </span>
                {loading
                  ? resetPasswordMode
                    ? 'Sending reset link...'
                    : 'Signing in...'
                  : resetPasswordMode
                  ? 'Send reset link'
                  : 'Sign in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;