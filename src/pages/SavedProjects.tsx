import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface SavedMod {
  id: string;
  title: string;
  subtitle: string | null;
  author_name: string;
  icon_url: string | null;
  category: string;
  downloads: number;
}

const SavedProjects: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [mods, setMods] = useState<SavedMod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSaved = async () => {
      if (!user) return;
      const { data: saves } = await supabase
        .from('user_saves')
        .select('mod_id')
        .eq('user_id', user.id);

      if (!saves || saves.length === 0) { setLoading(false); return; }

      const modIds = saves.map(s => s.mod_id);
      const { data: modsData } = await supabase
        .from('mods')
        .select('id, title, subtitle, author_name, icon_url, category, downloads')
        .in('id', modIds);

      if (modsData) setMods(modsData as SavedMod[]);
      setLoading(false);
    };
    fetchSaved();
  }, [user]);

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="relative z-10 mx-auto w-full max-w-[900px]">
        <Link to="/mods" className="mb-6 inline-flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-2 font-label-caps text-[11px] text-on-surface-variant shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t('mods.back')}
        </Link>

        <h1 className="mb-8 font-headline-lg text-[40px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[52px]">
          {t('mods.saved_projects')}
        </h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
          </div>
        ) : mods.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-black bg-surface-container p-12 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">bookmark_border</span>
            <p className="font-headline-md text-[18px] text-white">{t('mods.no_saved')}</p>
            <p className="font-body-sm text-on-surface-variant">{t('mods.no_saved_hint')}</p>
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
                    by {mod.author_name} • {mod.downloads} downloads
                  </p>
                </div>
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageAnimator>
  );
};

export default SavedProjects;
