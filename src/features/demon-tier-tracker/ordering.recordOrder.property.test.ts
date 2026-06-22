/**
 * Property 14: Tier list ordering.
 *
 * Feature: demon-tier-tracker, Property 14: Tier list ordering
 *
 * *For any* set of demon records, the rendered records for each demon are
 * ordered by percentage descending, with ties broken alphabetically
 * (ascending) by player name, and each rendered record shows its player
 * together with an integer percentage in 0..100.
 *
 * Validates: Requirements 9.3, 9.5
 *
 * Strategy: generate random flat `tier_list_view` rows (random usernames,
 * percentages that may be fractional or numeric strings, random demons/tiers),
 * run the pure `groupByTier`, and assert that within every demon group:
 *   - records are sorted by percentage descending, ties broken by username
 *     ascending (case-insensitive, matching the implementation), and
 *   - every percentage is an integer in 0..100.
 * The tie-break is verified case-insensitively because `orderRecords` lowercases
 * usernames before comparing.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  groupByTier,
  DIFFICULTY_TIER_ORDER,
  type DifficultyTier,
  type TierListViewRow,
} from './ordering';

/** A username with mixed case so the case-insensitive tie-break is exercised. */
const usernameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 12 });

/**
 * A percentage as the view might surface it: a plain number (possibly
 * fractional, possibly out of range) or the same value as a string, plus a few
 * pathological strings. The implementation normalizes all of these to an
 * integer in 0..100.
 */
const percentageArb: fc.Arbitrary<number | string> = fc.oneof(
  fc.double({ min: -50, max: 150, noNaN: true }),
  fc.integer({ min: -50, max: 150 }),
  fc.double({ min: -50, max: 150, noNaN: true }).map((n) => String(n)),
  fc.constantFrom('not-a-number', '', '50.5', '100', '0'),
);

const tierArb: fc.Arbitrary<DifficultyTier> = fc.constantFrom(
  ...DIFFICULTY_TIER_ORDER,
);

/**
 * A row generator. We draw a small pool of level_ids so multiple rows collapse
 * onto the same demon, producing demons with several records to order.
 */
const rowArb: fc.Arbitrary<TierListViewRow> = fc
  .record({
    level_id: fc.constantFrom('1', '2', '3', '4', '5'),
    demon_name: fc.string({ minLength: 1, maxLength: 16 }),
    difficulty_tier: tierArb,
    username: usernameArb,
    percentage: percentageArb,
    updated_at: fc.constant('2024-01-01T00:00:00.000Z'),
  });

describe('Feature: demon-tier-tracker, Property 14: Tier list ordering', () => {
  it('orders records by percentage desc, ties by username asc, integer 0..100', () => {
    fc.assert(
      fc.property(fc.array(rowArb, { maxLength: 60 }), (rows) => {
        const groups = groupByTier(rows);

        for (const group of groups) {
          for (const demon of group.demons) {
            const records = demon.records;
            for (let i = 0; i < records.length; i++) {
              const r = records[i];

              // Each rendered record shows a player and an integer percentage
              // in 0..100 (Req 9.3).
              expect(typeof r.username).toBe('string');
              expect(Number.isInteger(r.percentage)).toBe(true);
              expect(r.percentage).toBeGreaterThanOrEqual(0);
              expect(r.percentage).toBeLessThanOrEqual(100);

              if (i > 0) {
                const prev = records[i - 1];
                // Percentage descending (Req 9.5).
                expect(prev.percentage).toBeGreaterThanOrEqual(r.percentage);
                // Ties broken alphabetically ascending by player name,
                // compared case-insensitively to match orderRecords (Req 9.5).
                if (prev.percentage === r.percentage) {
                  const a = prev.username.toLowerCase();
                  const b = r.username.toLowerCase();
                  expect(a <= b).toBe(true);
                }
              }
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
