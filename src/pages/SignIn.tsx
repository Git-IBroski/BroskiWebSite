import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PageAnimator from '../components/PageAnimator';

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, acceptTerms, profile } = useAuth();
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsTerms, setNeedsTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // If redirected here because user hasn't accepted terms, show terms screen directly
  useEffect(() => {
    const state = location.state as { needsTerms?: boolean } | null;
    if (state?.needsTerms && profile && !profile.accepted_terms) {
      setNeedsTerms(true);
    }
  }, [location.state, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn(identifier, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.profile && !res.profile.accepted_terms) {
      // User logged in but hasn't accepted terms yet
      setNeedsTerms(true);
    } else {
      navigate('/');
    }
  };

  const handleAcceptTerms = async () => {
    if (!acceptedTerms) {
      setError('Devi accettare i Termini di Servizio e la Privacy Policy per continuare.');
      return;
    }
    setError('');
    setLoading(true);
    const res = await acceptTerms();
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      navigate('/');
    }
  };

  return (
    <PageAnimator className="relative flex min-h-[calc(100vh-76px)] w-full items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl"></div>
      <div className="pointer-events-none absolute right-[-10rem] bottom-24 h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:p-8">
          <div className="absolute inset-0 bg-surface-container-lowest" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 2px, transparent 2px)', backgroundSize: '24px 24px', opacity: 0.4 }}></div>
          <div className="absolute -right-14 -top-14 h-44 w-44 rotate-12 rounded-[2rem] border-4 border-black bg-primary-container opacity-80"></div>
          <div className="absolute -left-10 bottom-8 hidden h-28 w-28 rotate-45 rounded-3xl border-4 border-black bg-tertiary opacity-70 md:block"></div>

          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="flex h-16 w-16 -rotate-3 items-center justify-center rounded-3xl border-4 border-black bg-secondary-container shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <span className="material-symbols-outlined text-3xl text-white">{needsTerms ? 'gavel' : 'login'}</span>
            </div>
            <div className="text-center">
              <h1 className="font-headline-lg text-[36px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[48px]">
                {needsTerms ? 'ACCETTA I TERMINI' : t('signin.title')}
              </h1>
              <p className="mt-2 font-body-sm font-bold text-on-surface-variant">
                {needsTerms ? 'Per continuare devi accettare i nostri termini aggiornati.' : t('signin.subtitle')}
              </p>
            </div>

            {!needsTerms ? (
              <>
                <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="font-label-caps text-label-caps text-on-surface-variant">{t('signin.identifier')}</label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      placeholder={t('signin.identifier_placeholder')}
                      className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-lg text-on-surface placeholder:text-on-surface-variant/50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/40 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="font-label-caps text-label-caps text-on-surface-variant">{t('signin.password')}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder={t('signin.password_placeholder')}
                      className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-lg text-on-surface placeholder:text-on-surface-variant/50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/40 transition-all"
                    />
                  </div>

                  {error && (
                    <div className="rounded-2xl border-[3px] border-black bg-error-container px-4 py-3 font-body-sm font-bold text-on-error-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 w-full rounded-2xl border-[4px] border-black bg-secondary-container px-6 py-4 font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? t('signin.loading') : t('signin.button')}
                  </button>
                </form>

                <div className="flex w-full items-center gap-3">
                  <div className="h-[2px] flex-1 bg-surface-container-highest"></div>
                  <span className="font-label-caps text-[11px] text-on-surface-variant">{t('signin.or')}</span>
                  <div className="h-[2px] flex-1 bg-surface-container-highest"></div>
                </div>

                <Link
                  to="/signup"
                  className="w-full rounded-2xl border-[4px] border-black bg-surface-bright px-6 py-4 text-center font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {t('signin.create_account')}
                </Link>
              </>
            ) : (
              <div className="flex w-full flex-col gap-4">
                <div className="flex items-start gap-3 rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <input
                    type="checkbox"
                    id="accept-terms-signin"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 rounded border-2 border-black accent-primary-container"
                  />
                  <label htmlFor="accept-terms-signin" className="font-body-sm text-[13px] text-on-surface-variant leading-relaxed">
                    Accetto i{' '}
                    <Link to="/tou" target="_blank" className="font-bold text-primary-container underline hover:text-primary">
                      Termini di Servizio
                    </Link>{' '}
                    e la{' '}
                    <Link to="/pp" target="_blank" className="font-bold text-primary-container underline hover:text-primary">
                      Privacy Policy
                    </Link>{' '}
                    della Broski Community.
                  </label>
                </div>

                {error && (
                  <div className="rounded-2xl border-[3px] border-black bg-error-container px-4 py-3 font-body-sm font-bold text-on-error-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleAcceptTerms}
                  disabled={loading}
                  className="w-full rounded-2xl border-[4px] border-black bg-primary-container px-6 py-4 font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? '...' : 'ACCETTA E CONTINUA'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageAnimator>
  );
};

export default SignIn;
