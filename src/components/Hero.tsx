import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { carouselMembers, CAROUSEL_INTERVAL_MS } from '../config/carouselConfig';
import { LINKS_CONFIG } from '../config/linksConfig';
import { useLanguage } from '../context/LanguageContext';

const Hero: React.FC = () => {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Logica per l'autoscroll e la barra di caricamento
  useEffect(() => {
    // Reset della barra di caricamento ad ogni cambio slide (solo se gestito esternamente in timeout o animazione, altrimenti spostare fuori dall'effect)
    const resetProgressTimeout = setTimeout(() => {
      setProgress(0);
    }, 0);

    const updateInterval = 50; // Aggiorna la barra ogni 50ms per fluidità
    const step = (updateInterval / CAROUSEL_INTERVAL_MS) * 100;

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + step;
      });
    }, updateInterval);

    const slideTimer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % carouselMembers.length);
    }, CAROUSEL_INTERVAL_MS);

    return () => {
      clearTimeout(resetProgressTimeout);
      clearInterval(progressTimer);
      clearInterval(slideTimer);
    };
  }, [currentIndex]); // Si resetta e riparte quando cambia la slide, anche manualmente

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % carouselMembers.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? carouselMembers.length - 1 : prev - 1));
  };

  const currentMember = carouselMembers[currentIndex];

  return (
    <section className="relative w-full overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
      <div className="absolute inset-0 bg-surface-container-lowest" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 2px, transparent 2px)', backgroundSize: '26px 26px', opacity: 0.4 }}></div>
      <div className="absolute -left-16 top-12 h-44 w-44 rotate-12 rounded-[2rem] border-4 border-black bg-secondary-container opacity-90"></div>
      <div className="absolute -right-14 -top-16 h-60 w-60 rounded-full border-4 border-black bg-primary-container opacity-90"></div>
      <div className="absolute bottom-8 right-16 hidden h-28 w-28 rotate-45 rounded-3xl border-4 border-black bg-tertiary opacity-80 md:block"></div>

      <div className="relative z-10 grid min-h-[680px] gap-8 p-6 sm:p-8 lg:grid-cols-[1.08fr_0.92fr] lg:p-10">
        <div className="flex flex-col items-start justify-center gap-5">
          <div className="inline-flex -rotate-2 items-center gap-2 rounded-2xl border-[3px] border-black bg-secondary-container px-3 py-2 font-label-caps text-label-caps text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            {t('hero.badge')}
          </div>

          <div>
            <h1 className="font-headline-lg text-[54px] uppercase leading-[0.88] tracking-tighter text-white drop-shadow-[6px_6px_0px_rgba(0,0,0,1)] sm:text-[82px] lg:text-[108px]">
              BROSKI
              <span className="block text-secondary-container">COMMUNITY</span>
            </h1>
            <p className="mt-5 max-w-2xl rounded-3xl border-[3px] border-black bg-surface-container-high p-4 font-body-lg font-bold text-on-surface-variant shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              {t('hero.subtitle')}
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-3">
            <a 
              href={LINKS_CONFIG.discord} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-secondary-container px-5 py-3 font-headline-md text-[16px] text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              <span className="material-symbols-outlined">rocket_launch</span>
              {t('hero.cta.discord')}
            </a>
            <Link 
              to="/wiki"
              className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-surface-bright px-5 py-3 font-headline-md text-[16px] text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              <span className="material-symbols-outlined">menu_book</span>
              {t('hero.cta.wiki')}
            </Link>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border-[3px] border-black bg-surface-container-high p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-headline-md text-3xl text-white">9</span>
                <span className="material-symbols-outlined rounded-2xl border-2 border-black bg-primary-container p-2 text-2xl text-white">groups</span>
              </div>
              <p className="mt-2 font-label-caps text-[11px] text-on-surface-variant">{t('hero.stats.crew')}</p>
            </div>
            <div className="rounded-3xl border-[3px] border-black bg-surface-container-high p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-headline-md text-3xl text-white">SMP</span>
                <span className="material-symbols-outlined rounded-2xl border-2 border-black bg-secondary-container p-2 text-2xl text-white">dns</span>
              </div>
              <p className="mt-2 font-label-caps text-[11px] text-on-surface-variant">{t('hero.stats.server')}</p>
            </div>
            <div className="rounded-3xl border-[3px] border-black bg-surface-container-high p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-headline-md text-3xl text-white">LIVE</span>
                <span className="material-symbols-outlined rounded-2xl border-2 border-black bg-tertiary p-2 text-2xl text-black">smart_display</span>
              </div>
              <p className="mt-2 font-label-caps text-[11px] text-on-surface-variant">{t('hero.stats.chaos')}</p>
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center">
          <div 
            className="group relative flex h-[430px] w-full max-w-[520px] rotate-2 items-center justify-center overflow-hidden rounded-[2rem] border-[4px] border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-colors duration-500 sm:h-[560px]"
            style={{ backgroundColor: currentMember.bgColor }}
          >
          
            {/* Sfondo animato / placeholder quando l'immagine non è presente */}
            {/* Rimosso overlay scuro per mantenere i colori del config brillanti */}
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.8) 2px, transparent 2px)', backgroundSize: '20px 20px' }}></div>
            <div className="absolute left-5 top-5 z-30 rounded-2xl border-2 border-black bg-black px-3 py-2 font-label-caps text-[10px] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              {t('hero.spotlight')}
            </div>
          
          
          

            {/* Carousel Immagini */}
            <div className="relative z-20 flex h-full w-full items-center justify-center">
              {carouselMembers.map((member, index) => (
                <div 
                  key={member.name}
                  className={`absolute inset-0 flex items-center justify-center p-8 transition-opacity duration-500 ease-in-out ${
                    index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  {/* Immagine della Skin. */}
                  <img 
                    src={member.image} 
                    alt={`Render 3D di ${member.name}`}
                    className="absolute bottom-[-10%] left-1/2 h-[108%] w-auto -translate-x-1/2 -rotate-3 object-cover drop-shadow-[8px_8px_0_rgba(0,0,0,0.45)] transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      // Fallback se l'immagine non è ancora stata caricata dall'utente
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.classList.add('fallback-active');
                    }}
                  />
                  
                  {/* Fallback UI: visibile solo se l'immagine va in errore e nasconde se stessa */}
                  <div className="absolute inset-0 hidden flex-col items-center justify-center px-6 text-center">
                    <span className="material-symbols-outlined mb-4 text-6xl text-white opacity-90 drop-shadow-md">3d_rotation</span>
                    <span className="rounded-xl border-2 border-black bg-white/90 px-3 py-1 font-label-caps text-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                      {t('hero.render.waiting')} {member.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Badge In Diretta */}
            <div className="absolute bottom-6 right-4 z-30 rounded-2xl border-[2px] border-black bg-black px-3 py-2 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
              <span className="font-label-caps text-[11px] uppercase tracking-wider text-white">
                {`${t('hero.live')}: ${currentMember.name.toUpperCase()}`}
              </span>
            </div>
          
            {/* Controlli manuali */}
            <div className="absolute bottom-6 left-4 z-30 flex gap-2">
              <button 
                onClick={handlePrev}
                className="rounded-xl border-[2px] border-black bg-black p-2 text-white shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-colors hover:bg-white hover:text-black active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button 
                onClick={handleNext}
                className="rounded-xl border-[2px] border-black bg-black p-2 text-white shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-colors hover:bg-white hover:text-black active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>

            {/* Progress Bar (Timer) in basso */}
            <div className="absolute bottom-0 left-0 z-30 h-2 w-full bg-black/30">
              <div 
                className="h-full bg-white !important transition-all ease-linear"
                style={{ width: `${progress}%`, transitionDuration: '50ms', backgroundColor: 'white' }}
              />
            </div>

            <style>{`
              .fallback-active .hidden {
                display: flex;
              }
            `}</style>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
