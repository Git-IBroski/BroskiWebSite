import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  groupByTier,
  DIFFICULTY_TIER_ORDER,
  type DifficultyTier,
  type TierListViewRow,
} from './ordering';

/**
 * Property 15: Difficulty group ordering
 *
 * Feature: demon-tier-tracker, Property 15: Difficulty group ordering —
 * for any set of demons, the rendered tier groups appear in order from highest
 * difficulty to lowest difficulty (the canonical {@link DIFFICULTY_TIER_ORDER},
 * extreme → ... → easy). Tiers with no demons are omitted.
 *
 * Validates: Requirements 9.1
 */

/** Arbitrary difficulty tier drawn from the canonical set. */
const tierArb: fc.Arbitrary<DifficultyTier> = fc.constantFrom(
  ...DIFFICULTY_TIER_ORDER,
);

/**
 * Arbitrary for a single {@link TierListViewRow}. `level_id` is drawn from a
 * small pool so that multiple rows can share a demon (the view yields one row
 * per player record), exercising demons that span several tiers across the set.
 */
const rowArb: fc.Arbitrary<TierListViewRow> = fc.record({
  level_id: fc.integer({ min: 1, max: 12 }).map((n) => String(n)),
  demon_name: fc.string({ minLength: 1, maxLength: 16 }),
  difficulty_tier: tierArb,
  username: fc.string({ minLength: 1, maxLength: 12 }),
  percentage: fc.oneof(
    fc.integer({ min: 0, max: 100 }),
    fc.float({ min: 0, max: 100, noNaN: true }),
  ),
  // `updated_at` is immaterial to tier-group ordering; use a fixed timestamp
  // (a valid epoch-millis range) so the generator never yields invalid dates.
  updated_at: fc
    .integer({ min: 0, max: 4_102_444_800_000 })
    .map((ms) => new Date(ms).toISOString()),
});

/**
 * A demon's tier is determined by its first-encountered row (groupByTier keys
 * demons by level_id and records the tier from the first row seen). This mirror
 * computes the set of tiers actually present in the grouped output.
 */
function presentTiers(rows: readonly TierListViewRow[]): Set<DifficultyTier> {
  const tierByLevelId = new Map<string, DifficultyTier>();
  for (const row of rows) {
    if (!tierByLevelId.has(row.level_id)) {
      tierByLevelId.set(row.level_id, row.difficulty_tier);
    }
  }
  return new Set(tierByLevelId.values());
}

describe('Property 15: Difficulty group ordering', () => {
  it('renders present tier groups in canonical highest→lowest order, omitting empty tiers', () => {
    fc.assert(
      fc.property(fc.array(rowArb, { maxLength: 60 }), (rows) => {
        const groups = groupByTier(rows);
        const emittedTiers = groups.map((g) => g.difficulty_tier);

        // Each present tier appears exactly once (no duplicate groups).
        const uniqueEmitted = new Set(emittedTiers);
        expect(uniqueEmitted.size).toBe(emittedTiers.length);

        // The emitted tiers are exactly the tiers present in the input.
        const expectedPresent = presentTiers(rows);
        expect(uniqueEmitted).toEqual(expectedPresent);

        // Emitted order is consistent with DIFFICULTY_TIER_ORDER: the emitted
        // sequence is the canonical order filtered to the present tiers.
        const expectedOrder = DIFFICULTY_TIER_ORDER.filter((t) =>
          expectedPresent.has(t),
        );
        expect(emittedTiers).toEqual(expectedOrder);

        // And, directly: each tier's canonical index strictly increases.
        const indices = emittedTiers.map((t) => DIFFICULTY_TIER_ORDER.indexOf(t));
        for (let i = 1; i < indices.length; i++) {
          expect(indices[i]).toBeGreaterThan(indices[i - 1]);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('emits every present tier (and only those) for a deterministic spanning example', () => {
    // Build rows so that demons span several distinct tiers; "insane" and
    // "medium" are intentionally absent to confirm empty tiers are omitted.
    const rows: TierListViewRow[] = [
      { level_id: '1', demon_name: 'A', difficulty_tier: 'easy', username: 'p1', percentage: 50, updated_at: '2024-01-01T00:00:00Z' },
      { level_id: '2', demon_name: 'B', difficulty_tier: 'extreme', username: 'p2', percentage: 100, updated_at: '2024-01-01T00:00:00Z' },
      { level_id: '3', demon_name: 'C', difficulty_tier: 'hard', username: 'p3', percentage: 25, updated_at: '2024-01-01T00:00:00Z' },
    ];

    const emitted = groupByTier(rows).map((g) => g.difficulty_tier);
    expect(emitted).toEqual(['extreme', 'hard', 'easy']);
  });
});
