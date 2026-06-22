/**
 * Demon Tier Tracker — Stats_Viewer page (React container).
 *
 * Container for the ranked stats route. Reads the read-only tier-list view via
 * {@link usePlayerStats} (anon Supabase, SELECT only), derives the leaderboard +
 * per-player stats with the pure `scoring.ts` logic, owns the selected-player
 * state, and delegates rendering to {@link StatsViewerView}. Loading/error UI
 * lives here; all data/empty branches live in the view.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageAnimator from '../../components/PageAnimator';
import { usePlayerStats } from './usePlayerStats';
import StatsViewerView from './StatsViewerView';

const LoadingState: React.FC = () => (
  <div className="flex justify-center py-16">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
  </div>
);

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-black bg-surface-container p-12 text-center shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
    <span className="material-symbols-outlined text-[64px] text-red-400/60">error</span>
    <p className="font-headline-md text-[18px] text-white">Impossibile caricare la classifica</p>
    <p className="max-w-md font-body-sm text-on-surface-variant">{message}</p>
    <button
      onClick={onRetry}
      className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-primary-container px-6 py-3 font-headline-md text-[15px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
    >
      <span className="material-symbols-outlined text-[20px]">refresh</span>
      Riprova
    </button>
  </div>
);

/** Tab switcher between the Demon List and Stats Viewer pages. */
const Tabs: React.FC = () => (
  <div className="mb-8 flex items-center gap-6 font-headline-md uppercase tracking-tight">
    <Link
      to="/demon-tier-list"
      className="text-on-surface-variant transition-colors hover:text-white"
    >
      Demon List
    </Link>
    <span className="text-yellow-400 underline decoration-4 underline-offset-8">
      Stats Viewer
    </span>
  </div>
);

const StatsViewerPage: React.FC = () => {
  const { leaderboard, statsByPlayer, loading, error, refetch } = usePlayerStats();
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

  // Default the selection to the leaderboard leader once data loads, and keep
  // the selection valid if it disappears on a refetch.
  useEffect(() => {
    if (leaderboard.length === 0) {
      setSelectedUsername(null);
      return;
    }
    setSelectedUsername((current) => {
      if (current && leaderboard.some((e) => e.username === current)) {
        return current;
      }
      return leaderboard[0].username;
    });
  }, [leaderboard]);

  const selected = selectedUsername
    ? statsByPlayer.get(selectedUsername) ?? null
    : null;

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="pointer-events-none absolute left-[-8rem] top-28 h-72 w-72 rounded-full bg-primary-container/10 blur-3xl" />

      <div className="mx-auto w-full max-w-[1280px]">
        <header className="mb-6">
          <h1 className="font-headline-lg text-[40px] leading-none tracking-tight text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            Stats Viewer
          </h1>
          <p className="mt-3 max-w-2xl font-body-lg text-on-surface-variant">
            Classifica della community: punti, rank e progressi sui demon.
          </p>
        </header>

        <Tabs />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <StatsViewerView
            leaderboard={leaderboard}
            selectedUsername={selectedUsername}
            selected={selected}
            onSelect={setSelectedUsername}
          />
        )}
      </div>
    </PageAnimator>
  );
};

export default StatsViewerPage;
