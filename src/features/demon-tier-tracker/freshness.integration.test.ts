/**
 * Integration test for tier list freshness (task 6.8).
 *
 * Validates: Requirements 9.8
 *
 * Req 9.8: "WHEN a visitor loads a Tier_List_Site page after the underlying
 * records in the Database have changed, THE Tier_List_Site SHALL display the
 * updated records reflecting all committed changes as of the time the page load
 * begins."
 *
 * ENVIRONMENT NOTE — approach used:
 * A true end-to-end freshness test would mount the React page against a live
 * Supabase instance, change rows out-of-band, reload, and assert the DOM. That
 * needs anon Supabase creds, `@testing-library/react`, and jsdom — none of which
 * are part of this repo's toolchain (vitest runs in the `node` environment), and
 * we deliberately avoid pulling in heavy rendering deps.
 *
 * Instead we validate the *freshness contract* deterministically by mocking the
 * Supabase client module so `.from(view).select(cols)` returns a dataset we
 * control. The site's read path is exercised through the real
 * {@link fetchTierListRows} — the exact function the {@link useTierList} hook
 * calls on every load/refetch — composed with the real {@link groupByTier}
 * transform the page renders. We then:
 *   1. perform a first read against dataset A and assert the grouped output
 *      reflects A;
 *   2. mutate the underlying mock data to dataset B ("records changed in the
 *      Database");
 *   3. perform a SECOND read (the "next page load") and assert the grouped
 *      output now reflects the committed B data.
 *
 * Because each load issues a fresh SELECT against the view (no caching), the
 * second read reflects whatever the DB holds at that moment — exactly the
 * "next page load reflects committed changes" guarantee of Req 9.8 — without any
 * full page-reload object.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Controllable dataset the mocked Supabase client returns from select(). The
// test mutates `currentRows` to simulate the Database records changing between
// page loads. `lastFrom`/`lastSelect` capture the query the read path issues so
// we can assert it always targets the read-only view (a fresh SELECT per load).
let currentRows: unknown[] = [];
let currentError: { message: string } | null = null;
let lastFrom: string | null = null;
let lastSelect: string | null = null;
let selectCallCount = 0;

vi.mock('../../config/supabaseClient', () => ({
  supabase: {
    from(view: string) {
      lastFrom = view;
      return {
        select(columns: string) {
          lastSelect = columns;
          selectCallCount += 1;
          // Resolve to the dataset committed "as of now" — a fresh read.
          return Promise.resolve({
            data: currentError ? null : currentRows,
            error: currentError,
          });
        },
      };
    },
  },
}));

// Imported AFTER vi.mock so the mocked client is wired in.
import {
  fetchTierListRows,
  TIER_LIST_VIEW,
  TIER_LIST_COLUMNS,
} from './useTierList';
import { groupByTier } from './ordering';

/** Build a flat view row for the mocked dataset. */
function row(
  level_id: string,
  demon_name: string,
  difficulty_tier: string,
  username: string,
  percentage: number,
): Record<string, unknown> {
  return {
    level_id,
    demon_name,
    difficulty_tier,
    username,
    percentage,
    updated_at: '2024-01-01T00:00:00.000Z',
  };
}

// Dataset A: one extreme demon with a single sub-100% record.
const datasetA = [row('111', 'Bloodbath', 'extreme', 'alice', 62)];

// Dataset B ("records changed"): alice improved to 100%, and a new player
// (bob) plus a brand-new demon in a different tier appeared.
const datasetB = [
  row('111', 'Bloodbath', 'extreme', 'alice', 100),
  row('111', 'Bloodbath', 'extreme', 'bob', 75),
  row('222', 'Cataclysm', 'insane', 'cara', 40),
];

beforeEach(() => {
  currentRows = [];
  currentError = null;
  lastFrom = null;
  lastSelect = null;
  selectCallCount = 0;
});

describe('Tier list freshness — next page load reflects committed changes (Req 9.8)', () => {
  it('reflects updated records on a subsequent read after the data changes', async () => {
    // ---- First page load: dataset A ----
    currentRows = datasetA;
    const first = await fetchTierListRows();
    expect(first.error).toBeNull();
    const groupedA = groupByTier(first.rows);

    // A: a single extreme tier group with one demon holding alice@62.
    expect(groupedA).toHaveLength(1);
    expect(groupedA[0].difficulty_tier).toBe('extreme');
    expect(groupedA[0].demons).toHaveLength(1);
    expect(groupedA[0].demons[0].records).toEqual([
      { username: 'alice', percentage: 62, updated_at: '2024-01-01T00:00:00.000Z' },
    ]);

    // ---- Records change in the Database (out-of-band) ----
    currentRows = datasetB;

    // ---- Next page load: a fresh SELECT must reflect the committed B data ----
    const second = await fetchTierListRows();
    expect(second.error).toBeNull();
    const groupedB = groupByTier(second.rows);

    // Two tiers now render, highest difficulty first (extreme before insane).
    expect(groupedB.map((g) => g.difficulty_tier)).toEqual(['extreme', 'insane']);

    // Bloodbath now has two records, ordered percentage desc: alice@100, bob@75.
    const bloodbath = groupedB[0].demons[0];
    expect(bloodbath.demon_name).toBe('Bloodbath');
    expect(bloodbath.records).toEqual([
      { username: 'alice', percentage: 100, updated_at: '2024-01-01T00:00:00.000Z' },
      { username: 'bob', percentage: 75, updated_at: '2024-01-01T00:00:00.000Z' },
    ]);

    // The newly-added demon in the insane tier appears too.
    expect(groupedB[1].demons[0].demon_name).toBe('Cataclysm');
    expect(groupedB[1].demons[0].records).toEqual([
      { username: 'cara', percentage: 40, updated_at: '2024-01-01T00:00:00.000Z' },
    ]);

    // The second read genuinely differs from the first (freshness, not cache).
    expect(groupedB).not.toEqual(groupedA);
  });

  it('issues a fresh read-only SELECT against the tier list view on every load', async () => {
    currentRows = datasetA;

    await fetchTierListRows();
    expect(lastFrom).toBe(TIER_LIST_VIEW);
    expect(lastSelect).toBe(TIER_LIST_COLUMNS);
    expect(selectCallCount).toBe(1);

    // A subsequent load performs another independent SELECT (no caching), so
    // the next page load always reflects current committed state (Req 9.8).
    await fetchTierListRows();
    expect(selectCallCount).toBe(2);
    expect(lastFrom).toBe(TIER_LIST_VIEW);
  });

  it('surfaces a read error without throwing, leaving no stale rows', async () => {
    currentError = { message: 'connection reset' };
    const result = await fetchTierListRows();
    expect(result.error).toBe('connection reset');
    expect(result.rows).toEqual([]);
  });
});
