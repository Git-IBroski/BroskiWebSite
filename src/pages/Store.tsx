import React from 'react';
import PageAnimator from '../components/PageAnimator';
import { useLanguage } from '../context/LanguageContext';

const MOCK_PRODUCTS = [
  { id: 1, name: 'Broski Hoodie', price: '€49.99', icon: 'checkroom', color: 'bg-primary-container', tag: 'COMING SOON' },
  { id: 2, name: 'Broski Tee', price: '€29.99', icon: 'dry_cleaning', color: 'bg-secondary-container', tag: 'COMING SOON' },
  { id: 3, name: 'Broski Cap', price: '€24.99', icon: 'face_retouching_natural', color: 'bg-blue-600', tag: 'COMING SOON' },
  { id: 4, name: 'Broski Mousepad', price: '€19.99', icon: 'mouse', color: 'bg-tertiary', tag: 'COMING SOON' },
  { id: 5, name: 'Broski Sticker Pack', price: '€9.99', icon: 'sticky_note_2', color: 'bg-error', tag: 'COMING SOON' },
  { id: 6, name: 'Broski Poster', price: '€14.99', icon: 'image', color: 'bg-primary', tag: 'COMING SOON' },
];

const Store: React.FC = () => {
  const { t: _t } = useLanguage();

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      {/* Background blobs */}
      <div className="pointer-events-none absolute left-[-8rem] top-20 h-72 w-72 rounded-full bg-tertiary/15 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-[30rem] h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 bottom-[10rem] h-64 w-64 rounded-full bg-primary-container/15 blur-3xl" />

      <div className="mx-auto w-full max-w-[1280px]">
        {/* BENTO GRID */}
        <div className="grid auto-rows-[minmax(120px,auto)] grid-cols-4 gap-4 md:grid-cols-6 lg:grid-cols-12">

          {/* ===== HERO BANNER — full width ===== */}
          <div className="col-span-4 row-span-2 relative overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] md:col-span-6 lg:col-span-8 lg:row-span-3">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 2px, transparent 2px)', backgroundSize: '26px 26px' }} />
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rotate-12 rounded-[2rem] border-4 border-black bg-tertiary opacity-60" />
            <div className="pointer-events-none absolute -left-10 bottom-[-2rem] h-40 w-40 rounded-full border-4 border-black bg-secondary-container opacity-60" />
            <div className="relative z-10 flex h-full flex-col justify-center gap-5">
              <div className="inline-flex -rotate-2 items-center gap-2 self-start rounded-2xl border-[3px] border-black bg-tertiary px-4 py-2 font-label-caps text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-[18px]">storefront</span>
                BROSKI STORE
              </div>
              <h1 className="font-headline-lg text-[48px] uppercase leading-[0.9] tracking-tighter text-white drop-shadow-[6px_6px_0px_rgba(0,0,0,1)] sm:text-[64px] lg:text-[80px]">
                MERCH
                <span className="block text-tertiary">IN ARRIVO</span>
              </h1>
              <p className="max-w-md rounded-3xl border-[3px] border-black bg-surface-container-high p-4 font-body-lg font-bold text-on-surface-variant shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                Il merch ufficiale della Broski Community sta arrivando. Resta sintonizzato per hoodie, tee, accessori e molto altro.
              </p>
            </div>
          </div>

          {/* ===== STATUS CARD ===== */}
          <div className="col-span-4 row-span-1 flex flex-col items-center justify-center gap-3 rounded-[2rem] border-[4px] border-black bg-surface-container-highest p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:col-span-3 lg:col-span-4 lg:row-span-2">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-[4px] border-black bg-tertiary shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <span className="material-symbols-outlined text-[44px] text-black">construction</span>
            </div>
            <h3 className="text-center font-headline-md text-[20px] uppercase text-white">Work in Progress</h3>
            <p className="text-center font-body-sm text-on-surface-variant">Stiamo preparando qualcosa di speciale per voi.</p>
          </div>

          {/* ===== NOTIFY CARD ===== */}
          <div className="col-span-4 row-span-1 flex flex-col items-center justify-center gap-3 rounded-[2rem] border-[4px] border-black bg-blue-600 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:col-span-3 lg:col-span-4 lg:row-span-1">
            <span className="material-symbols-outlined text-[36px] text-white">notifications_active</span>
            <p className="text-center font-headline-md text-[16px] text-white">Seguici su Discord per sapere quando apriamo!</p>
          </div>

          {/* ===== PRODUCT GRID — mockup items ===== */}
          {MOCK_PRODUCTS.map((product) => (
            <div
              key={product.id}
              className="col-span-2 row-span-2 group relative flex flex-col items-center justify-between overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] md:col-span-3 lg:col-span-4"
            >
              {/* Decorative blob */}
              <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border-4 border-black opacity-60 transition-transform duration-700 group-hover:scale-125 ${product.color}`} />

              {/* Product icon placeholder */}
              <div className={`relative z-10 mb-4 flex h-24 w-24 items-center justify-center rounded-3xl border-[4px] border-black ${product.color} shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-transform duration-300 group-hover:rotate-3`}>
                <span className="material-symbols-outlined text-[48px] text-white">{product.icon}</span>
              </div>

              {/* Product info */}
              <div className="relative z-10 flex w-full flex-col items-center gap-2">
                <h3 className="font-headline-md text-[16px] uppercase text-white">{product.name}</h3>
                <span className="font-body-sm text-on-surface-variant">{product.price}</span>
              </div>

              {/* Coming soon tag */}
              <div className="relative z-10 mt-4 w-full">
                <div className="flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-label-caps text-[11px] text-on-surface-variant shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  {product.tag}
                </div>
              </div>
            </div>
          ))}

          {/* ===== BOTTOM BANNER — full width ===== */}
          <div className="col-span-4 row-span-1 relative flex items-center justify-center gap-4 overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container-highest p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:col-span-6 lg:col-span-12">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 2px, transparent 2px)', backgroundSize: '24px 24px' }} />
            <span className="material-symbols-outlined relative z-10 text-[32px] text-tertiary">local_shipping</span>
            <p className="relative z-10 text-center font-headline-md text-[18px] uppercase text-white">
              Spedizione in tutta Europa • Qualità Premium • Design Esclusivi
            </p>
            <span className="material-symbols-outlined relative z-10 text-[32px] text-tertiary">verified</span>
          </div>

        </div>
      </div>
    </PageAnimator>
  );
};

export default Store;
