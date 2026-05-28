import React from 'react';
import Hero from '../components/Hero';
import Features from '../components/Features';
import UnstableSmp from '../components/UnstableSmp';
import Idols from '../components/Idols';
import PageAnimator from '../components/PageAnimator';
import TransitionLink from '../components/TransitionLink';
import { useLanguage } from '../context/LanguageContext';

const Home: React.FC = () => {
  const { t } = useLanguage();
  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="pointer-events-none absolute left-[-8rem] top-28 h-72 w-72 rounded-full bg-secondary-container/20 blur-3xl"></div>
      <div className="pointer-events-none absolute right-[-10rem] top-[44rem] h-80 w-80 rounded-full bg-primary-container/20 blur-3xl"></div>
      <div className="pointer-events-none absolute left-[-10rem] bottom-[24rem] h-80 w-80 rounded-full bg-tertiary/10 blur-3xl"></div>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-margin">
        <div>
          <Hero />
        </div>
        <div>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <TransitionLink to="/social" className="group relative overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[11px_11px_0px_0px_rgba(0,0,0,1)]">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full border-4 border-black bg-secondary-container opacity-80 transition-transform duration-700 group-hover:scale-125"></div>
              <div className="relative z-10 mb-5 flex h-16 w-16 -rotate-3 items-center justify-center rounded-3xl border-4 border-black bg-secondary-container text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-3xl">groups</span>
              </div>
              <p className="relative z-10 font-label-caps text-[11px] text-tertiary">{t('home.social.subtitle')}</p>
              <h2 className="relative z-10 font-headline-md text-3xl uppercase text-white">{t('home.social.title')}</h2>
              <p className="relative z-10 mt-2 font-body-sm font-bold text-on-surface-variant">{t('home.social.description')}</p>
            </TransitionLink>
            <TransitionLink to="/tierlist" className="group relative overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[11px_11px_0px_0px_rgba(0,0,0,1)]">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-[2rem] border-4 border-black bg-primary-container opacity-80 transition-transform duration-700 group-hover:rotate-12"></div>
              <div className="relative z-10 mb-5 flex h-16 w-16 rotate-3 items-center justify-center rounded-3xl border-4 border-black bg-primary-container text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-3xl">military_tech</span>
              </div>
              <p className="relative z-10 font-label-caps text-[11px] text-tertiary">{t('home.tierlist.subtitle')}</p>
              <h2 className="relative z-10 font-headline-md text-3xl uppercase text-white">{t('home.tierlist.title')}</h2>
              <p className="relative z-10 mt-2 font-body-sm font-bold text-on-surface-variant">{t('home.tierlist.description')}</p>
            </TransitionLink>
            <TransitionLink to="/progetti" className="group relative overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[11px_11px_0px_0px_rgba(0,0,0,1)]">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full border-4 border-black bg-tertiary opacity-80 transition-transform duration-700 group-hover:scale-125"></div>
              <div className="relative z-10 mb-5 flex h-16 w-16 -rotate-3 items-center justify-center rounded-3xl border-4 border-black bg-tertiary text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-3xl">rocket_launch</span>
              </div>
              <p className="relative z-10 font-label-caps text-[11px] text-tertiary">{t('home.projects.subtitle')}</p>
              <h2 className="relative z-10 font-headline-md text-3xl uppercase text-white">{t('home.projects.title')}</h2>
              <p className="relative z-10 mt-2 font-body-sm font-bold text-on-surface-variant">{t('home.projects.description')}</p>
            </TransitionLink>
          </section>
        </div>
        <div>
          <Features />
        </div>
        <div>
          <UnstableSmp />
        </div>
        <div>
          <Idols />
        </div>
      </div>
    </PageAnimator>
  );
};

export default Home;
