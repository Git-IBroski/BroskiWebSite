import React, { useState, useEffect } from 'react';
import PageAnimator from '../components/PageAnimator';
import TransitionLink from '../components/TransitionLink';
import { useLanguage } from '../context/LanguageContext';

const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

const ManteinancePage: React.FC = () => {
  const { t } = useLanguage();
  const [glitchText, setGlitchText] = useState(':(');
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsGlitching(true);
      let count = 0;
      const glitch = setInterval(() => {
        setGlitchText(
          Array.from({ length: 2 }, () =>
            GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
          ).join('')
        );
        count++;
        if (count > 6) {
          clearInterval(glitch);
          setGlitchText(':(');
          setIsGlitching(false);
        }
      }, 60);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  return (
    <PageAnimator className="relative flex min-h-[calc(100vh-76px)] flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-surface-container-lowest"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 2px, transparent 2px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-8">
        <h1
          className={`select-none text-center font-headline-lg leading-none tracking-tighter text-white drop-shadow-[8px_8px_0px_rgba(0,0,0,1)] transition-all duration-100 ${
            isGlitching ? 'scale-105 text-tertiary' : ''
          }`}
          style={{ fontSize: 'clamp(80px, 18vw, 160px)' }}
        >
          {glitchText}
        </h1>

        <p className="max-w-md text-center font-body-lg text-on-surface-variant">
          {t('maintenance.tierlist_message')}
        </p>

        <div className="flex items-center gap-4">
          <TransitionLink
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-primary-container px-6 py-3 font-headline-md text-[16px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <span className="material-symbols-outlined text-[20px]">home</span>
            {t('common.gohome')}
          </TransitionLink>
        </div>
      </div>
    </PageAnimator>
  );
};

export default ManteinancePage;
