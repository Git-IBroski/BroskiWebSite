/**
 * Demon Tier Tracker — tier list page (React container).
 *
 * Container component for the public demon tier list route. It reads the
 * read-only tier list data with {@link useTierList} (anon Supabase client, no
 * writes — Req 10.5, 9.8), groups/orders it with the pure {@link groupByTier}
 * (Req 9.1, 9.3, 9.5), and delegates rendering to the presentational
 * {@link DemonTierListView}. It owns the loading and error UI; the empty-state,
 * per-demon no-records, and 100% indicator branches live in the view so they
 * stay testable from props.
 *
 * _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.5_
 */
import React, { useMemo } from 'react';
import PageAnimator from '../../components/PageAnimator';
import { useTierList } from './useTierList';
import { groupByTier } from './ordering';
import DemonTierListView from './DemonTierListView';

/**
 * Loading indicator shown while the initial read is in flight.
 */
const LoadingState: React.FC = () => (
  <div className="flex justify-center py-16">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
  </div>
);

/**
 * Error panel shown when the read fails, with a retry that re-reads committed
 * state (still read-only).
 */
const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-black bg-surface-container p-12 text-center shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
    <span className="material-symbols-outlined text-[64px] text-red-400/60">error</span>
    <p className="font-headline-md text-[18px] text-white">Could not load the tier list</p>
    <p className="max-w-md font-body-sm text-on-surface-variant">{message}</p>
    <button
      onClick={onRetry}
      className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-primary-container px-6 py-3 font-headline-md text-[15px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
    >
      <span className="material-symbols-outlined text-[20px]">refresh</span>
      Retry
    </button>
  </div>
);

/**
 * The demon tier list page. Wires data → grouping → presentation, with loading
 * and error fallbacks.
 */
const DemonTierListPage: React.FC = () => {
  const { rows, loading, error, refetch } = useTierList();

  // Group/order only when rows change (pure transform).
  const groups = useMemo(() => groupByTier(rows), [rows]);

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="pointer-events-none absolute left-[-8rem] top-28 h-72 w-72 rounded-full bg-primary-container/10 blur-3xl" />

      <div className="mx-auto w-full max-w-[1280px]">
        <header className="mb-8">
          <h1 className="font-headline-lg text-[40px] leading-none tracking-tight text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            Demon Tier List
          </h1>
          <p className="mt-3 max-w-2xl font-body-lg text-on-surface-variant">
            Community demon completions, ranked by difficulty tier.
          </p>
        </header>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <DemonTierListView groups={groups} />
        )}
      </div>
    </PageAnimator>
  );
};

export default DemonTierListPage;
