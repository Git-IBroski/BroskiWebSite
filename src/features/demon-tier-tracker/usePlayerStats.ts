/**
 * Demon Tier Tracker — ranked player-stats data hook (React).
 *
 * Reuses the exact same read-only fetch as the tier list ({@link fetchTierListRows}
 * against `dtt_tier_list_view`) and derives the ranked Stats_Viewer model from
 * it with the pure {@link computePlayerStats} / {@link buildLeaderboard} logic.
 * It is strictly READ-ONLY (SELECT only) and fetches once on mount, reflecting
 * committed state at load time, just like {@link useTierList}.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchTierListRows } from './useTierList';
import type { TierListViewRow } from './ordering';
import {
  buildLeaderboard,
  computePlayerStats,
  type LeaderboardEntry,
  type PlayerStats,
} from './scoring';

/** State returned by {@link usePlayerStats}. */
export interface UsePlayerStatsResult {
  /** Ranked leaderboard, points descending. */
  leaderboard: LeaderboardEntry[];
  /** Per-player stats keyed by username. */
  statsByPlayer: Map<string, PlayerStats>;
  /** True while the read is in flight. */
  loading: boolean;
  /** Error message if the read failed, otherwise null. */
  error: string | null;
  /** Re-run the read against current committed state (still read-only). */
  refetch: () => void;
}

/**
 * Read the tier-list view once and expose the derived leaderboard + per-player
 * stats. All aggregation happens in memoized pure functions.
 */
export function usePlayerStats(): UsePlayerStatsResult {
  const [rows, setRows] = useState<TierListViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true);
    setError(null);
    const { rows: fetchedRows, error: fetchError } = await fetchTierListRows();
    if (signal?.cancelled) return;
    if (fetchError) {
      setError(fetchError);
      setRows([]);
    } else {
      setRows(fetchedRows);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => computePlayerStats(rows), [rows]);
  const leaderboard = useMemo(() => buildLeaderboard(stats), [stats]);
  const statsByPlayer = useMemo(() => {
    const map = new Map<string, PlayerStats>();
    for (const s of stats) map.set(s.username, s);
    return map;
  }, [stats]);

  return { leaderboard, statsByPlayer, loading, error, refetch };
}
