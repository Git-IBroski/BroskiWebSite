import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface FollowedCreator {
  creator_id: string;
  creator_name: string;
  minecraft_username: string;
  project_count: number;
}

const FollowedCreators: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [creators, setCreators] = useState<FollowedCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowed = async () => {
      if (!user) return;
      const { data: follows } = await supabase
        .from('user_follows')
        .select('creator_id')
        .eq('follower_id', user.id);

      if (!follows || follows.length === 0) { setLoading(false); return; }

      const creatorIds = follows.map(f => f.creator_id);
      const results: FollowedCreator[] = [];

      for (const cid of creatorIds) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('minecraft_username')
          .eq('id', cid)
          .single();
        const { data: mods } = await supabase
          .from('mods')
          .select('author_name')
          .eq('author_id', cid)
          .eq('status', 'approved');
        const name = mods?.[0]?.author_name || profileData?.minecraft_username || 'Unknown';
        results.push({
          creator_id: cid,
          creator_name: name,
          minecraft_username: profileData?.minecraft_username || name,
          project_count: mods?.length || 0,
        });
      }
      setCreators(results);
      setLoading(false);
    };
    fetchFollowed();
  }, [user]);

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="relative z-10 mx-auto w-full max-w-[900px]">
        <Link to="/mods" className="mb-6 inline-flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-2 font-label-caps text-[11px] text-on-surface-variant shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t('mods.back')}
        </Link>

        <h1 className="mb-8 font-headline-lg text-[40px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[52px]">
          {t('mods.followed_creators')}
        </h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
          </div>
        ) : creators.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-black bg-surface-container p-12 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">person_off</span>
            <p className="font-headline-md text-[18px] text-white">{t('mods.no_followed')}</p>
            <p className="font-body-sm text-on-surface-variant">{t('mods.no_followed_hint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {creators.map((creator) => (
              <Link
                key={creator.creator_id}
                to={`/mods/creator/${creator.creator_id}`}
                className="group flex items-center gap-5 rounded-2xl border-[2px] border-black/40 bg-surface-container p-5 transition-all hover:border-black/70 hover:bg-surface-container-high"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                  <img src={`https://mc-heads.net/avatar/${creator.minecraft_username}/64`} alt={creator.creator_name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <h3 className="font-headline-md text-[18px] text-white group-hover:text-primary-container">{creator.creator_name}</h3>
                  <p className="font-body-sm text-[13px] text-on-surface-variant">{creator.project_count} {t('mods.projects')}</p>
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

export default FollowedCreators;
