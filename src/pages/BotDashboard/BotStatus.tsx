import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';

interface BotStatusData {
  online: boolean;
  guild_name?: string;
  guild_id?: number;
  members?: { total: number; humans: number; bots: number };
  open_tickets?: number;
  latency_ms?: number;
  cogs?: string[];
  error?: string;
}

const BotStatus: React.FC = () => {
  const [status, setStatus] = useState<BotStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non autenticato');

      const resp = await fetch('/api/bot-admin/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Errore');
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleRestart = async () => {
    if (!confirm('Sei sicuro di voler riavviare il bot?')) return;
    setRestarting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non autenticato');

      const resp = await fetch('/api/bot-admin/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || data.detail || 'Errore');

      alert('✅ Riavvio in corso! Il bot tornerà online tra qualche secondo.');
    } catch (err: any) {
      alert('❌ ' + err.message);
    } finally {
      setRestarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-error font-bold mb-4">❌ {error}</p>
        <button
          onClick={fetchStatus}
          className="rounded-xl border-[3px] border-black bg-tertiary px-6 py-2 font-label-caps text-[12px] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          RIPROVA
        </button>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div>
      <h2 className="font-headline-md text-[28px] text-white mb-6">📊 Stato del Bot</h2>

      {/* Status Card */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-label-caps text-[11px] text-on-surface-variant">STATO</p>
          <p className={`font-headline-md text-[24px] mt-1 ${status.online ? 'text-green-400' : 'text-error'}`}>
            {status.online ? '🟢 ONLINE' : '🔴 OFFLINE'}
          </p>
        </div>

        <div className="rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-label-caps text-[11px] text-on-surface-variant">PING</p>
          <p className="font-headline-md text-[24px] mt-1 text-white">
            {status.latency_ms}ms
          </p>
        </div>

        <div className="rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-label-caps text-[11px] text-on-surface-variant">MEMBRI</p>
          <p className="font-headline-md text-[24px] mt-1 text-white">
            {status.members?.humans ?? '—'}
            <span className="text-sm text-on-surface-variant ml-1">umani</span>
          </p>
        </div>

        <div className="rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-label-caps text-[11px] text-on-surface-variant">TICKET APERTI</p>
          <p className="font-headline-md text-[24px] mt-1 text-tertiary">
            {status.open_tickets ?? '—'}
          </p>
        </div>
      </div>

      {/* Guild Info */}
      <div className="rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] mb-6">
        <p className="font-label-caps text-[11px] text-on-surface-variant">GUILD</p>
        <p className="font-headline-md text-[20px] text-white mt-1">
          {status.guild_name || 'Non trovata'}
          <span className="text-sm text-on-surface-variant ml-2">ID: {status.guild_id || '—'}</span>
        </p>
      </div>

      {/* Cogs */}
      <div className="mb-6">
        <p className="font-label-caps text-[11px] text-on-surface-variant mb-2">COG CARICATI</p>
        <div className="flex flex-wrap gap-2">
          {(status.cogs || []).map((cog) => (
            <span
              key={cog}
              className="rounded-lg border-2 border-black bg-surface-container-high px-3 py-1 text-xs font-bold text-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              {cog}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={fetchStatus}
          className="rounded-xl border-[3px] border-black bg-surface-bright px-6 py-2 font-label-caps text-[12px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          🔄 AGGIORNA
        </button>
        <button
          onClick={handleRestart}
          disabled={restarting}
          className="rounded-xl border-[3px] border-black bg-error-container px-6 py-2 font-label-caps text-[12px] text-on-error-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
        >
          {restarting ? '⏳ RIAVVIO...' : '🔁 RIAVVIA BOT'}
        </button>
      </div>
    </div>
  );
};

export default BotStatus;
