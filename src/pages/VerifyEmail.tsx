import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import PageAnimator from '../components/PageAnimator';

const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  // Se l'utente è già loggato (email già confermata), vai a home
  useEffect(() => {
    if (user && !verifying) {
      navigate('/');
    }
  }, [user, verifying, navigate]);

  // Gestisci il token di conferma email dall'URL
  useEffect(() => {
    const handleEmailConfirmation = async () => {
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      // Se c'è un token di conferma nell'URL
      if (token && type === 'email_confirmation') {
        try {
          // Supabase gestisce automaticamente la verifica quando visiti il link
          // ma possiamo anche forzare un refresh della sessione
          const { error: sessionError } = await supabase.auth.refreshSession();
          if (sessionError) {
            setError('Errore durante la verifica. Riprova.');
          } else {
            setVerified(true);
            // Dopo 2 secondi, redirect alla home
            setTimeout(() => navigate('/'), 2000);
          }
        } catch {
          setError('Link di verifica non valido o scaduto.');
        }
      }
      setVerifying(false);
    };

    handleEmailConfirmation();
  }, [searchParams, navigate]);

  const email = searchParams.get('email') || 'la tua email';

  return (
    <PageAnimator className="relative flex min-h-[calc(100vh-76px)] w-full items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl"></div>
      <div className="pointer-events-none absolute right-[-10rem] bottom-24 h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:p-8">
          <div className="absolute inset-0 bg-surface-container-lowest" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 2px, transparent 2px)', backgroundSize: '24px 24px', opacity: 0.4 }}></div>
          <div className="absolute -right-14 -top-14 h-44 w-44 rotate-12 rounded-[2rem] border-4 border-black bg-tertiary opacity-80"></div>

          <div className="relative z-10 flex flex-col items-center gap-6 text-center">
            {verifying ? (
              <>
                <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-3xl border-4 border-black bg-primary-container shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                  <span className="material-symbols-outlined text-3xl text-white">hourglass_top</span>
                </div>
                <h1 className="font-headline-lg text-[32px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                  Verificando...
                </h1>
              </>
            ) : verified ? (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border-4 border-black bg-green-500 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                  <span className="material-symbols-outlined text-3xl text-white">check_circle</span>
                </div>
                <h1 className="font-headline-lg text-[36px] uppercase leading-none text-green-400 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                  EMAIL CONFERMATA!
                </h1>
                <p className="font-body-sm font-bold text-on-surface-variant">
                  Stai per essere reindirizzato alla home...
                </p>
              </>
            ) : error ? (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border-4 border-black bg-error-container shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                  <span className="material-symbols-outlined text-3xl text-on-error-container">error</span>
                </div>
                <h1 className="font-headline-lg text-[32px] uppercase leading-none text-error drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                  ERRORE
                </h1>
                <p className="rounded-2xl border-[3px] border-black bg-error-container px-4 py-3 font-body-sm font-bold text-on-error-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {error}
                </p>
                <button
                  onClick={() => navigate('/signin')}
                  className="w-full rounded-2xl border-[4px] border-black bg-surface-bright px-6 py-4 font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  TORNA AL LOGIN
                </button>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border-4 border-black bg-primary-container shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                  <span className="material-symbols-outlined text-3xl text-white">mail</span>
                </div>
                <h1 className="font-headline-lg text-[36px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                  CONFERMA EMAIL
                </h1>
                <div className="rounded-3xl border-[3px] border-black bg-surface-container-high p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                  <p className="font-body-lg font-bold text-on-surface">
                    Controlla la tua casella di posta!
                  </p>
                  <p className="mt-3 font-body-sm text-on-surface-variant">
                    Abbiamo inviato un'email di conferma a <span className="text-primary-container font-bold">{email}</span>.<br /><br />
                    Clicca sul link nell'email per attivare il tuo account.<br />
                    Una volta confermato, verrai automaticamente reindirizzato alla home.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3">
                  <button
                    onClick={() => navigate('/signin')}
                    className="w-full rounded-2xl border-[4px] border-black bg-surface-bright px-6 py-4 font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                  >
                    HO GIÀ CONFERMATO
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="w-full rounded-2xl border-[3px] border-black bg-transparent px-6 py-3 font-label-caps text-label-caps text-on-surface-variant transition-all hover:bg-surface-container-high"
                  >
                    TORNA ALLA REGISTRAZIONE
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageAnimator>
  );
};

export default VerifyEmail;
