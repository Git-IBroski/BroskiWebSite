import React, { useEffect, useState } from 'react';
import { supabase } from '../../config/supabaseClient';
import TransitionLink from '../../components/TransitionLink';
import PageAnimator from '../../components/PageAnimator';
import { useLanguage } from '../../context/LanguageContext';
import SmpMarkdown from './SmpMarkdown';
import { pick } from './smpTypes';
import type { SmpInfo, SmpPlugin } from './smpTypes';

interface SmpHomeProps {
  base: string;
}

// SMP-specific UI copy (kept local — the global t() dictionary doesn't cover these).
const UI = {
  it: {
    badge: 'BROSKI COMMUNITY',
    apply: 'Candidati ora',
    applyShort: 'Candidati',
    discord: 'Discord',
    closed: 'Candidature chiuse',
    loading: 'Caricamento…',
    about: 'Chi siamo',
    plugins: 'Plugin & Feature',
    rules: 'Regole',
    stat_mode: 'Modalità',
    stat_mode_v: 'Survival',
    stat_edition: 'Edizione',
    stat_players: 'Community',
    stat_players_v: 'Attiva',
    join_title: 'Pronto a entrare?',
    join_desc: 'Compila la candidatura e il nostro team la esaminerà al più presto.',
    how_title: 'Come si entra',
    how: [
      { icon: 'login', title: 'Accedi', desc: 'Usa il tuo account Broski (o registrati in un attimo).' },
      { icon: 'edit_document', title: 'Candidati', desc: 'Rispondi a poche domande sul tuo stile di gioco.' },
      { icon: 'verified', title: 'Aspetta l’ok', desc: 'Il team valuta la richiesta e ti contatta su Discord.' },
    ],
  },
  en: {
    badge: 'BROSKI COMMUNITY',
    apply: 'Apply now',
    applyShort: 'Apply',
    discord: 'Discord',
    closed: 'Applications closed',
    loading: 'Loading…',
    about: 'About us',
    plugins: 'Plugins & Features',
    rules: 'Rules',
    stat_mode: 'Mode',
    stat_mode_v: 'Survival',
    stat_edition: 'Edition',
    stat_players: 'Community',
    stat_players_v: 'Active',
    join_title: 'Ready to join?',
    join_desc: 'Fill out the application and our team will review it as soon as possible.',
    how_title: 'How to join',
    how: [
      { icon: 'login', title: 'Sign in', desc: 'Use your Broski account (or create one in seconds).' },
      { icon: 'edit_document', title: 'Apply', desc: 'Answer a few questions about how you play.' },
      { icon: 'verified', title: 'Get approved', desc: 'The team reviews it and reaches out on Discord.' },
    ],
  },
};

const StatCard = ({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) => (
  <div className="rounded-3xl border-[3px] border-black bg-surface-container-high p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
    <div className="flex items-center justify-between gap-3">
      <span className="font-headline-md text-2xl text-white">{value}</span>
      <span className={`material-symbols-outlined rounded-2xl border-2 border-black p-2 text-2xl text-white ${accent}`}>{icon}</span>
    </div>
    <p className="mt-2 font-label-caps text-[11px] text-on-surface-variant">{label}</p>
  </div>
);

const SmpHome: React.FC<SmpHomeProps> = ({ base }) => {
  const { language } = useLanguage();
  const ui = UI[language];
  const [info, setInfo] = useState<SmpInfo | null>(null);
  const [plugins, setPlugins] = useState<SmpPlugin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: infoData }, { data: pluginData }] = await Promise.all([
        supabase.from('smp_info').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('smp_plugins').select('*').order('sort_order', { ascending: true }),
      ]);
      setInfo((infoData as SmpInfo) ?? null);
      setPlugins((pluginData as SmpPlugin[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const applyHref = `${base}/application`;
  const heroSubtitle = pick(language, info?.hero_subtitle, info?.hero_subtitle_en);
  const about = pick(language, info?.about, info?.about_en);
  const rules = pick(language, info?.rules, info?.rules_en);
  const open = info?.applications_open !== false;

  return (
    <PageAnimator className="relative flex-grow overflow-hidden px-4 py-8 sm:px-margin select-none">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-[36rem] h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl" />

      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-margin">
        {/* ===== HERO ===== */}
        <header className="relative overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
          <div className="absolute inset-0 bg-surface-container-lowest" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 2px, transparent 2px)', backgroundSize: '26px 26px', opacity: 0.4 }} />
          <div className="absolute -left-16 top-12 h-44 w-44 rotate-12 rounded-[2rem] border-4 border-black bg-secondary-container opacity-90" />
          <div className="absolute -right-14 -top-16 h-60 w-60 rounded-full border-4 border-black bg-primary-container opacity-90" />
          <div className="absolute bottom-8 right-16 hidden h-28 w-28 rotate-45 rounded-3xl border-4 border-black bg-tertiary opacity-80 md:block" />

          <div className="relative z-10  gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
            <div className="flex flex-col items-center gap-5">
              <div className="inline-flex -rotate-2 items-center gap-2 rounded-2xl border-[3px] border-black bg-secondary-container px-3 py-2 font-label-caps text-label-caps text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-[18px]">dns</span>
                {ui.badge}
              </div>

              <div className="flex flex-col items-center gap-4">
                <h1 className="font-headline-lg text-[52px] uppercase leading-[0.9] tracking-tighter text-white drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] sm:text-[76px] lg:text-[92px]">
                  <img src="./broskismphorizontal.webp" alt="Broski SMP" className='max-h-[300px] w-auto' />
                </h1>
                {heroSubtitle && (
                  <p className="mt-4 max-w-2xl rounded-3xl border-[3px] border-black bg-surface-container-high p-4 font-body-lg font-bold text-on-surface-variant shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] text-center">
                    {heroSubtitle}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                {open ? (
                  <TransitionLink
                    to={applyHref}
                    className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-yellow-400 px-5 py-3 font-headline-md text-[16px] uppercase tracking-tighter text-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                  >
                    <span className="material-symbols-outlined">edit_document</span>
                    {ui.apply}
                  </TransitionLink>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-surface-container-high px-5 py-3 font-headline-md text-[16px] uppercase tracking-tighter text-on-surface-variant shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                    <span className="material-symbols-outlined">lock</span>
                    {ui.closed}
                  </span>
                )}
                {info?.discord_url && (
                  <a
                    href={info.discord_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-primary-container px-5 py-3 font-headline-md text-[16px] uppercase tracking-tighter text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                  >
                    <span className="material-symbols-outlined">forum</span>
                    {ui.discord}
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-[2rem] border-[4px] border-black bg-surface-container p-8 text-center font-headline-md text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            {ui.loading}
          </div>
        ) : (
          <>
            {/* ===== BENTO GRID ===== */}
            <div className="grid grid-cols-1 gap-margin lg:grid-cols-3">
              {/* About (col-span-2) */}
              {about && (
                <div className="lg:col-span-2">
                  <div className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] border-4 border-black bg-surface-container p-6 shadow-[9px_9px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] md:p-8">
                    <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full border-4 border-black bg-primary-container opacity-70 transition-transform duration-700 group-hover:scale-110" />
                    <div className="relative z-10 mb-5 flex items-center gap-3">
                      <span className="material-symbols-outlined flex h-14 w-14 -rotate-3 items-center justify-center rounded-3xl border-4 border-black bg-primary-container text-3xl text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        info
                      </span>
                      <h2 className="font-headline-md text-3xl text-white">{ui.about}</h2>
                    </div>
                    <div className="relative z-10">
                      <SmpMarkdown>{about}</SmpMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Discord / join card (col-span-1) */}
              <div className="lg:col-span-1">
                <div className="group relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-[2rem] border-4 border-black bg-primary-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[11px_11px_0px_0px_rgba(0,0,0,1)] md:p-8">
                  <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.8) 2px, transparent 2px)', backgroundSize: '20px 20px' }} />
                  <div className="absolute -left-10 bottom-8 h-32 w-32 rotate-12 rounded-3xl border-4 border-black bg-tertiary opacity-80 transition-transform duration-700 group-hover:rotate-[24deg]" />
                  <div className="relative z-10 mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border-4 border-black bg-black text-3xl text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <span className="material-symbols-outlined">forum</span>
                  </div>
                  <h2 className="relative z-10 mb-2 font-headline-md text-3xl text-white drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]">{ui.join_title}</h2>
                  <p className="relative z-10 mb-auto font-body-sm font-bold text-white/90">{ui.join_desc}</p>
                  {open && (
                    <TransitionLink
                      to={applyHref}
                      className="relative z-10 mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border-[3px] border-black bg-yellow-400 px-5 py-3 text-center font-headline-md uppercase tracking-tighter text-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit_document</span>
                      {ui.applyShort}
                    </TransitionLink>
                  )}
                </div>
              </div>
            </div>

            {/* Plugins bento */}
            {plugins.length > 0 && (
              <section className="relative overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <span className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-black bg-tertiary text-2xl text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    extension
                  </span>
                  <h2 className="font-headline-md text-[26px] uppercase text-white md:text-3xl">{ui.plugins}</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {plugins.map((p, idx) => {
                    const accents = ['bg-primary-container', 'bg-secondary-container', 'bg-tertiary !text-black'];
                    const accent = accents[idx % accents.length];
                    return (
                      <div
                        key={p.id}
                        className="group relative overflow-hidden rounded-2xl border-[3px] border-black bg-surface-container-high p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[7px_7px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl border-[3px] border-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${accent}`}>
                          {p.icon && p.icon.startsWith('http') ? (
                            <img src={p.icon} alt="" className="h-6 w-6 rounded" />
                          ) : (
                            <span className="material-symbols-outlined text-[24px]">{p.icon || 'extension'}</span>
                          )}
                        </div>
                        <h3 className="mb-1 font-headline-md text-[18px] text-white">{pick(language, p.name, p.name_en)}</h3>
                        {pick(language, p.description, p.description_en) && (
                          <p className="font-body-sm text-[13px] leading-relaxed text-on-surface-variant">
                            {pick(language, p.description, p.description_en)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Rules + How to join */}
            <div className="grid grid-cols-1 gap-margin lg:grid-cols-3">
              {rules && (
                <section className="lg:col-span-2 relative overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-black bg-secondary-container text-2xl text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      gavel
                    </span>
                    <h2 className="font-headline-md text-[26px] uppercase text-white md:text-3xl">{ui.rules}</h2>
                  </div>
                  <SmpMarkdown>{rules}</SmpMarkdown>
                </section>
              )}

              <section className={`relative overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-8 ${rules ? '' : 'lg:col-span-3'}`}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-black bg-primary-container text-2xl text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    footprint
                  </span>
                  <h2 className="font-headline-md text-[22px] uppercase text-white md:text-[26px]">{ui.how_title}</h2>
                </div>
                <div className={`grid gap-3 ${rules ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
                  {ui.how.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-tertiary font-headline-md text-[15px] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-headline-md text-[15px] text-white">{step.title}</p>
                        <p className="font-body-sm text-[13px] text-on-surface-variant">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Bottom CTA */}
            {open && (
              <section className="relative overflow-hidden rounded-[2rem] border-[4px] border-black bg-primary-container p-8 text-center shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] md:p-12">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.8) 2px, transparent 2px)', backgroundSize: '22px 22px' }} />
                <div className="relative z-10 flex flex-col items-center gap-5">
                  <h2 className="font-headline-lg text-[32px] uppercase leading-none tracking-tighter text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] md:text-[48px]">
                    {ui.join_title}
                  </h2>
                  <p className="max-w-xl font-body-lg text-white/90">{ui.join_desc}</p>
                  <TransitionLink
                    to={applyHref}
                    className="inline-flex items-center gap-2 rounded-2xl border-[4px] border-black bg-yellow-400 px-6 py-3 font-headline-md text-[18px] uppercase tracking-tighter text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                  >
                    <span className="material-symbols-outlined">edit_document</span>
                    {ui.apply}
                  </TransitionLink>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PageAnimator>
  );
};

export default SmpHome;
