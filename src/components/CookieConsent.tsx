import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Cookie consent banner (bottom-right) + details modal, in the site's neo-brutalist
 * style. The choice is stored in a cookie scoped to the parent domain so it is
 * shared across ibroski.net and its subdomains (www, smp, ...). The banner only
 * appears until the user has accepted or declined.
 */

const CONSENT_KEY = 'broski-cookie-consent';
const ONE_YEAR = 60 * 60 * 24 * 365;

const cookieDomain = (): string | null => {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (host === 'ibroski.net' || host.endsWith('.ibroski.net')) return '.ibroski.net';
  return null;
};

const readConsent = (): 'accepted' | 'declined' | null => {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )broski-cookie-consent=([^;]*)/);
  const v = m ? decodeURIComponent(m[1]) : null;
  return v === 'accepted' || v === 'declined' ? v : null;
};

const writeConsent = (value: 'accepted' | 'declined') => {
  let str = `${CONSENT_KEY}=${value}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
  const domain = cookieDomain();
  if (domain) str += `; domain=${domain}`;
  if (window.location.protocol === 'https:') str += '; Secure';
  document.cookie = str;
};

const UI = {
  it: {
    title: 'Cookie? Cookie.',
    blurb: 'Usiamo cookie essenziali per tenerti connesso e ricordare le tue preferenze. Niente tracker, niente pubblicità.',
    accept: 'Accetta',
    details: 'Dettagli',
    decline: 'Rifiuta',
    modalTitle: 'Informativa sui cookie',
    modalIntro: 'La Broski Community usa solo i cookie necessari al funzionamento del sito. Non usiamo cookie di profilazione o pubblicitari di terze parti.',
    items: [
      { icon: 'lock', title: 'Sessione di accesso', desc: 'Ti mantiene connesso al tuo account su ibroski.net e su tutti i sottodomini (come smp.ibroski.net).' },
      { icon: 'translate', title: 'Preferenze', desc: 'Ricorda la lingua scelta (IT/EN) e questa stessa scelta sui cookie.' },
      { icon: 'block', title: 'Nessun tracciamento', desc: 'Nessun cookie di analytics, marketing o di terze parti.' },
    ],
    footer: 'Puoi cambiare idea in qualsiasi momento cancellando i cookie del browser.',
    close: 'Chiudi',
  },
  en: {
    title: 'Cookies? Cookies.',
    blurb: 'We use essential cookies to keep you logged in and remember your preferences. No trackers, no ads.',
    accept: 'Accept',
    details: 'Details',
    decline: 'Decline',
    modalTitle: 'Cookie notice',
    modalIntro: 'The Broski Community only uses cookies required for the site to work. We do not use profiling or third-party advertising cookies.',
    items: [
      { icon: 'lock', title: 'Login session', desc: 'Keeps you signed in to your account across ibroski.net and all subdomains (like smp.ibroski.net).' },
      { icon: 'translate', title: 'Preferences', desc: 'Remembers your language (IT/EN) and this very cookie choice.' },
      { icon: 'block', title: 'No tracking', desc: 'No analytics, marketing or third-party cookies whatsoever.' },
    ],
    footer: 'You can change your mind anytime by clearing your browser cookies.',
    close: 'Close',
  },
};

const CookieConsent: React.FC = () => {
  const { language } = useLanguage();
  const ui = UI[language] ?? UI.it;
  const [visible, setVisible] = useState(false); // controls mount
  const [shown, setShown] = useState(false); // controls enter animation
  const [details, setDetails] = useState(false);

  useEffect(() => {
    if (readConsent() !== null) return; // already chose
    setVisible(true);
    const t = setTimeout(() => setShown(true), 400); // slide in shortly after load
    return () => clearTimeout(t);
  }, []);

  const choose = (value: 'accepted' | 'declined') => {
    writeConsent(value);
    setShown(false);
    setDetails(false);
    // let the exit animation play before unmounting
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  return (
    <>
      {/* Bottom-right banner */}
      <div
        className={`fixed bottom-4 right-4 z-[60] w-[calc(100vw-2rem)] max-w-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] sm:bottom-6 sm:right-6 ${
          shown && !details ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
        }`}
      >
        <div className="rounded-[1.5rem] border-4 border-black bg-surface-container p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-[3px] border-black bg-yellow-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <img src="/cookies/Cookie.svg" alt="" className="h-7 w-7" />
            </span>
            <h2 className="font-headline-md text-[20px] uppercase leading-none tracking-tighter text-white">{ui.title}</h2>
          </div>
          <p className="mb-4 font-body-sm text-[14px] leading-relaxed text-on-surface-variant">{ui.blurb}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => choose('accepted')}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-[3px] border-black bg-yellow-400 px-4 py-2.5 font-headline-md text-[14px] uppercase tracking-tighter text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              <span className="material-symbols-outlined text-[18px]">check</span>
              {ui.accept}
            </button>
            <button
              onClick={() => setDetails(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-2.5 font-headline-md text-[14px] uppercase tracking-tighter text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              {ui.details}
            </button>
          </div>
        </div>
      </div>

      {/* Details modal */}
      {details && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDetails(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-[2rem] border-4 border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] md:p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-[3px] border-black bg-yellow-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <img src="/cookies/Cookie.svg" alt="" className="h-7 w-7" />
                </span>
                <h2 className="font-headline-md text-[22px] uppercase leading-none tracking-tighter text-white md:text-[26px]">{ui.modalTitle}</h2>
              </div>
              <button
                onClick={() => setDetails(false)}
                aria-label={ui.close}
                className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-black bg-surface-container-high text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="mb-5 font-body-sm text-[14px] leading-relaxed text-on-surface-variant">{ui.modalIntro}</p>

            <div className="mb-6 flex flex-col gap-3">
              {ui.items.map((it) => (
                <div key={it.title} className="flex items-start gap-3 rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-primary-container text-[22px] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {it.icon}
                  </span>
                  <div>
                    <p className="font-headline-md text-[15px] text-white">{it.title}</p>
                    <p className="font-body-sm text-[13px] leading-relaxed text-on-surface-variant">{it.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mb-5 font-body-sm text-[12px] italic text-on-surface-variant/70">{ui.footer}</p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => choose('accepted')}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-[3px] border-black bg-yellow-400 px-4 py-3 font-headline-md text-[15px] uppercase tracking-tighter text-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                {ui.accept}
              </button>
              <button
                onClick={() => choose('declined')}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-[3px] border-black bg-error-container px-4 py-3 font-headline-md text-[15px] uppercase tracking-tighter text-on-error-container shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                {ui.decline}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CookieConsent;
