import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface Mod {
  id: string;
  title: string;
  category: string;
  version: string;
  downloads: number;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'IN REVISIONE', color: 'bg-yellow-600', icon: 'hourglass_top' },
  approved: { label: 'APPROVATA', color: 'bg-green-600', icon: 'check_circle' },
  rejected: { label: 'RIFIUTATA', color: 'bg-error', icon: 'cancel' },
  on_hold: { label: 'IN ATTESA', color: 'bg-outline', icon: 'pause_circle' },
};

const MyMods: React.FC = () => {
  const { user } = useAuth();
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyMods = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('mods')
        .select('id, title, category, version, downloads, status, created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) setMods(data as Mod[]);
      setLoading(false);
    };
    fetchMyMods();
  }, [user]);

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary-container/15 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[900px]">
        <Link
          to="/mods"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-2 font-label-caps text-[11px] text-on-surface-variant shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          TORNA ALLE MODS
        </Link>

        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="font-headline-lg text-[40px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[56px]">
              LE MIE MOD
            </h1>
            <p className="mt-2 font-body-sm text-on-surface-variant">Gestisci le tue mod e controlla lo stato di approvazione.</p>
          </div>
          <Link
            to="/mods/upload"
            className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-tertiary px-5 py-3 font-headline-md text-[14px] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            NUOVA
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
          </div>
        ) : mods.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[2rem] border-[4px] border-black bg-surface-container p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">inventory_2</span>
            <p className="font-body-sm text-on-surface-variant">Non hai ancora caricato nessuna mod.</p>
            <Link
              to="/mods/upload"
              className="rounded-2xl border-[3px] border-black bg-primary-container px-6 py-3 font-headline-md text-[16px] text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1"
            >
              CARICA LA TUA PRIMA MOD
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {mods.map((mod) => {
              const status = statusConfig[mod.status] || statusConfig.pending;
              return (
                <Link
                  key={mod.id}
                  to={`/mods/${mod.id}`}
                  className="flex items-center justify-between rounded-2xl border-[4px] border-black bg-surface-container p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border-[3px] border-black bg-primary-container shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <span className="material-symbols-outlined text-[24px] text-white">extension</span>
                    </div>
                    <div>
                      <h3 className="font-headline-md text-[16px] text-white">{mod.title}</h3>
                      <p className="font-label-caps text-[10px] text-on-surface-variant">
                        {mod.category.toUpperCase()} • v{mod.version} • {mod.downloads} download
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 rounded-xl border-[2px] border-black px-3 py-1.5 font-label-caps text-[10px] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${status.color}`}>
                    <span className="material-symbols-outlined text-[14px]">{status.icon}</span>
                    {status.label}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageAnimator>
  );
};

export default MyMods;
