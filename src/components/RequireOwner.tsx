import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RequireOwnerProps {
  children: React.ReactNode;
}

const RequireOwner: React.FC<RequireOwnerProps> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-76px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-container border-t-transparent"></div>
          <p className="font-body-sm text-on-surface-variant">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!loading) {
    if (!user || !profile) {
      return <Navigate to="/signin" replace />;
    }

    if (profile.admin_rank !== 'owner') {
      return (
        <div className="flex min-h-[calc(100vh-76px)] items-center justify-center px-4">
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border-4 border-black bg-error-container shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-3xl text-on-error-container">shield_lock</span>
              </div>
              <h1 className="font-headline-lg text-[32px] uppercase leading-none text-error drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                ACCESSO RISERVATO
              </h1>
              <p className="font-body-sm font-bold text-on-surface-variant">
                Solo il <strong>proprietario</strong> del server può accedere alla dashboard del bot.
              </p>
              <p className="font-body-sm text-on-surface-variant/60">
                Se ritieni di dover avere accesso, contatta l'owner.
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default RequireOwner;
