import { useState, useEffect } from 'react';
import PageAnimator from '../components/PageAnimator';
import TransitionLink from '../components/TransitionLink';
import { useLanguage } from '../context/LanguageContext';

const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

const NotFound: React.FC = () => {
  const { t } = useLanguage();
  const [glitchText, setGlitchText] = useState('404');
  const [isGlitching, setIsGlitching] = useState(false);

  // Periodic glitch effect on the 404 text
  useEffect(() => {
    const interval = setInterval(() => {
      setIsGlitching(true);
      let count = 0;
      const glitch = setInterval(() => {
        setGlitchText(
          Array.from({ length: 3 }, () =>
            GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
          ).join('')
        );
        count++;
        if (count > 6) {
          clearInterval(glitch);
          setGlitchText('404');
          setIsGlitching(false);
        }
      }, 60);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <PageAnimator className="relative flex min-h-[calc(100vh-76px)] flex-col items-center justify-center overflow-hidden px-4 py-16">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0 bg-surface-container-lowest"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 2px, transparent 2px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-secondary-container/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-10 h-80 w-80 rounded-full bg-tertiary-container/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-primary-container/10 blur-3xl" />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-8">
        {/* Rotated badge */}
        <div className="inline-flex -rotate-3 items-center gap-2 rounded-2xl border-[3px] border-black bg-secondary-container px-4 py-2 font-label-caps text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <span className="material-symbols-outlined text-[18px]">error</span>
          PAGE NOT FOUND
        </div>

        {/* Giant 404 */}
        <h1
          className={`select-none text-center font-headline-lg leading-none tracking-tighter text-white drop-shadow-[8px_8px_0px_rgba(0,0,0,1)] transition-all duration-100 ${
            isGlitching ? 'scale-105 text-tertiary' : ''
          }`}
          style={{ fontSize: 'clamp(120px, 25vw, 240px)' }}
        >
          {glitchText}
        </h1>

        {/* Subtitle */}
        <p className="max-w-md text-center font-body-lg text-on-surface-variant">
          {t('notfound.message') !== 'notfound.message'
            ? t('notfound.message')
            : 'Questa pagina non esiste... forse è stata eliminata, o forse non è mai esistita.'}
        </p>

        {/* Decorative broken block */}
        <div className="flex items-center gap-3">
          <div className="h-1 w-12 rotate-2 rounded-full bg-outline-variant" />
          <span className="material-symbols-outlined text-[32px] text-outline-variant">
            broken_image
          </span>
          <div className="h-1 w-12 -rotate-2 rounded-full bg-outline-variant" />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <TransitionLink
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-primary-container px-8 py-4 font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[6px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <span className="material-symbols-outlined text-[22px]">home</span>
            TORNA ALLA HOME
          </TransitionLink>

          <TransitionLink
            to="/social"
            className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-surface-container-high px-6 py-4 font-headline-md text-[16px] text-on-surface shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <span className="material-symbols-outlined text-[20px]">group</span>
            SOCIAL
          </TransitionLink>
        </div>

        {/* Fun pixel art skull */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container px-4 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <span className="material-symbols-outlined text-[20px] text-tertiary">skull</span>
          <span className="font-label-caps text-[11px] text-on-surface-variant">
            ERROR 404 • BROSKI COMMUNITY
          </span>
          <span className="material-symbols-outlined text-[20px] text-tertiary">skull</span>
        </div>
      </div>
    </PageAnimator>
  );
};

export default NotFound;
