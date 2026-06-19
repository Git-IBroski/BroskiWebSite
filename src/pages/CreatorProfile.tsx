import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';
import { supabase } from '../config/supabaseClient';
import { useLanguage } from '../context/LanguageContext';

interface CreatorMod {
  id: string;
  title: string;
  subtitle: string | null;
  icon_url: string | null;
  category: string;
  downloads: number;
  mc_version: string;
  updated_at: string;
}

const CreatorProfile: React.FC = () => {
  const { creatorId } = useParams<{ creatorId: string }>();
  const { t } = useLanguage();
  const [mods, setMods] = useState<CreatorMod[]>([]);
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCreatorMods = async () => {
      if (!creatorId) return;
      const { data } = await supabase
        .from('mods')
        .select('id, title, subtitle, icon_url, category, downloads, mc_version, updated_at, author_name')
        .eq('author_id', creatorId)
        .eq('status', 'approved')
        .order('downloads', { ascending: false });

      if (data && data.length > 0) {
        setCreatorName((data[0] as any).author_name);
        setMods(data as CreatorMod[]);
      }
      setLoading(false);
    };
    fetchCreatorMods();
  }, [creatorId]);

  const formatDownloads = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin select-none">
      <div className="relative z-10 mx-auto w-full max-w-[900px]">
        <Link to="/mods/followed" className="mb-6 inline-flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-2 font-label-caps text-[11px] text-on-surface-variant shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t('mods.back')}
        </Link>

        {/* Creator header */}
        <div className="mb-8 flex items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-[3px] border-black bg-primary-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[36px] text-white">person</span>
          </div>
          <div>
            <h1 className="font-headline-lg text-[36px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[48px]">
              {creatorName || 'Creator'}
            </h1>
            <p className="mt-1 font-body-sm text-on-surface-variant">{mods.length} {t('mods.projects')}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
          </div>
        ) : mods.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-black bg-surface-container p-12 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">inventory_2</span>
            <p className="font-body-sm text-on-surface-variant">{t('mods.no_results')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mods.map((mod) => (
              <Link
                key={mod.id}
                to={`/mods/${mod.id}`}
                className="group flex items-center gap-5 rounded-2xl border-[2px] border-black/40 bg-surface-container p-5 transition-all hover:border-black/70 hover:bg-surface-container-high"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-[2px] border-black/40 bg-surface-container-high">
                  {mod.icon_url ? (
                    <img src={mod.icon_url} alt={mod.title} className="h-full w-full rounded-lg object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
                      {mod.category === 'plugin' ? 'extension' : 'build'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate font-headline-md text-[18px] text-white group-hover:text-primary-container">{mod.title}</h3>
                  <p className="font-body-sm text-[13px] text-on-surface-variant">
                    {mod.subtitle || `MC ${mod.mc_version}`}
                  </p>
                </div>
                <span className="font-body-sm text-[14px] font-bold text-on-surface-variant">
                  {formatDownloads(mod.downloads)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageAnimator>
  );
};

export default CreatorProfile;
