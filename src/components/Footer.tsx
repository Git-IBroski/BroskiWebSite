import React from 'react';
import { LINKS_CONFIG } from '../config/linksConfig';
import { useLanguage } from '../context/LanguageContext';
import TransitionLink from './TransitionLink';

// On the SMP subdomain these main-site routes don't exist in the SPA, so link to
// the main origin with a full navigation instead of trapping the client router.
const MAIN_ORIGIN = 'https://www.ibroski.net';
const onSmpIbroski = () =>
  typeof window !== 'undefined' &&
  window.location.hostname.startsWith('smp.') &&
  window.location.hostname.endsWith('.ibroski.net');

const FooterLink: React.FC<{ to: string; className: string; children: React.ReactNode }> = ({ to, className, children }) =>
  onSmpIbroski() ? (
    <a href={MAIN_ORIGIN + to} className={className}>{children}</a>
  ) : (
    <TransitionLink to={to} className={className}>{children}</TransitionLink>
  );

const Footer: React.FC = () => {
  const { t } = useLanguage();
  return (
    <footer className="bg-black w-full py-8 px-12 flex flex-col md:flex-row justify-between items-center gap-4 border-t-4 border-red-600">
      <div className="flex items-center">
        <img src="/logo/pm4f9d0.PNG" alt="Broski Logo" className="h-10 w-auto hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="flex flex-wrap gap-6 justify-center font-body-sm text-xs font-bold tracking-widest uppercase">
        <FooterLink className="text-slate-500 hover:text-blue-400 transition-colors bg-surface-container-lowest px-3 py-1 rounded-xl" to="/tou">{t('footer.terms')}</FooterLink>
        <FooterLink className="text-slate-500 hover:text-blue-400 transition-colors bg-surface-container-lowest px-3 py-1 rounded-xl" to="/pp">{t('footer.privacy')}</FooterLink>
        <FooterLink className="text-slate-500 hover:text-blue-400 transition-colors bg-surface-container-lowest px-3 py-1 rounded-xl" to="/contatti">{t('footer.contact')}</FooterLink>
        <a 
          className="text-slate-500 hover:text-blue-400 transition-colors bg-surface-container-lowest px-3 py-1 rounded-xl" 
          href={LINKS_CONFIG.discord}
          target="_blank"
          rel="noopener noreferrer"
        >
          Discord
        </a>
      </div>
      <div className="text-slate-500 font-body-sm text-xs font-bold tracking-widest text-center md:text-right uppercase bg-surface-container-lowest p-2 rounded-xl">
        © 2026 BROSKI - {t('footer.disclaimer')}
      </div>
    </footer>
  );
};

export default Footer;
