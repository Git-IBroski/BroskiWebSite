import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface Idea {
  id: string;
  title: string;
  content: string;
  rating: number;
  status: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'IN REVISIONE', color: 'bg-yellow-600', icon: 'hourglass_top' },
  reviewed: { label: 'LETTA', color: 'bg-primary-container', icon: 'visibility' },
  implemented: { label: 'IMPLEMENTATA', color: 'bg-green-600', icon: 'check_circle' },
  rejected: { label: 'RIFIUTATA', color: 'bg-error', icon: 'cancel' },
};

const MyIdeas: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyIdeas = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('ideas')
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setIdeas(data as Idea[]);
      setLoading(false);

      // Mark as seen
      await supabase.from('profiles').update({ last_ideas_seen_at: new Date().toISOString() }).eq('id', user.id);
    };
    fetchMyIdeas();
  }, [user]);

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="relative z-10 mx-auto w-full max-w-[800px]">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-2 font-label-caps text-[11px] text-on-surface-variant shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          HOME
        </Link>

        <h1 className="mb-8 font-headline-lg text-[40px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[52px]">
          {t('nav.my_ideas')}
        </h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
          </div>
        ) : ideas.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-black bg-surface-container p-12 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">lightbulb</span>
            <p className="font-headline-md text-[18px] text-white">{t('myideas.empty')}</p>
            <Link to="/progetti/idea" className="rounded-2xl border-[3px] border-black bg-tertiary px-6 py-3 font-headline-md text-[14px] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1">
              {t('myideas.submit_first')}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {ideas.map((idea) => {
              const status = STATUS_CONFIG[idea.status] || STATUS_CONFIG.pending;
              return (
                <div key={idea.id} className="rounded-2xl border-[3px] border-black bg-surface-container p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-headline-md text-[16px] text-white mb-1">{idea.title}</h3>
                      <p className="font-body-sm text-[13px] text-on-surface-variant line-clamp-2">{idea.content}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`material-symbols-outlined text-[14px] ${s <= idea.rating ? 'text-yellow-400' : 'text-on-surface-variant/20'}`}>star</span>
                          ))}
                        </div>
                        <span className="font-label-caps text-[9px] text-on-surface-variant/60">
                          {new Date(idea.created_at).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 rounded-xl border-[2px] border-black px-3 py-1.5 font-label-caps text-[9px] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${status.color}`}>
                      <span className="material-symbols-outlined text-[12px]">{status.icon}</span>
                      {status.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageAnimator>
  );
};

export default MyIdeas;
