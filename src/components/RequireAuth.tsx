import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * Protects routes: redirects to /signin if user is not logged in
 * or hasn't accepted terms yet.
 */
const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Still loading auth state — show nothing to avoid flash
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-76px)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
      </div>
    );
  }

  // Not logged in at all
  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // Logged in but hasn't accepted terms
  if (profile && !profile.accepted_terms) {
    return <Navigate to="/signin" state={{ from: location, needsTerms: true }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
