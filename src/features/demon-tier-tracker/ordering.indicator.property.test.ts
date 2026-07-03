/**
 * Property 16: Hundred-percent indicator.
 *
 * Feature: demon-tier-tracker, Property 16: Hundred-percent indicator
 *
 * *For any* rendered record, the 100% visual indicator is present if and only
 * if the record's percentage equals 100.
 *
 * Validates: Requirements 9.6
 *
 * Strategy: the indicator decision is a pure predicate over a record's
 * normalized integer percentage ({@link hasHundredPercentIndicator}). To keep
 * this property independent of DOM rendering we test that predicate directly,
 * composed with {@link toIntegerPercentage} (the same normalization the site
 * applies before rendering). We drive two generators:
 *   1. integer percentages in 0..100 (the in-range domain), and
 *   2. arbitrary numbers and numeric strings, including out-of-range values,
 *      to confirm normalization/clamping behaves and the iff still holds.
 * In every case we assert the indicator is shown iff the normalized percentage
 * is exactly 100.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { hasHundredPercentIndicator, toIntegerPercentage } from './ordering';

describe('Feature: demon-tier-tracker, Property 16: Hundred-percent indicator', () => {
  it('shows the indicator iff a normalized integer percentage (0..100) equals 100', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (percentage) => {
        const normalized = toIntegerPercentage(percentage);
        expect(hasHundredPercentIndicator(normalized)).toBe(normalized === 100);
        // In-range integers normalize to themselves, so the indicator tracks
        // the raw value too.
        expect(hasHundredPercentIndicator(normalized)).toBe(percentage === 100);
      }),
      { numRuns: 100 },
    );
  });

  it('holds for arbitrary (incl. out-of-range) values after clamping via toIntegerPercentage', () => {
    const rawValue = fc.oneof(
      fc.double({ noNaN: true }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.double({ min: -1000, max: 1000, noNaN: true }),
      fc.double({ noNaN: true }).map((n) => String(n)),
      fc.constantFrom(100, 100.0, '100', '100.00', 99.9, 100.4, 101, -5, 0, 'not-a-number'),
    );
    fc.assert(
      fc.property(rawValue, (value) => {
        const normalized = toIntegerPercentage(value);
        // Clamping guarantees the normalized value is an integer in 0..100.
        expect(Number.isInteger(normalized)).toBe(true);
        expect(normalized).toBeGreaterThanOrEqual(0);
        expect(normalized).toBeLessThanOrEqual(100);
        // The indicator is present iff the normalized percentage is exactly 100.
        expect(hasHundredPercentIndicator(normalized)).toBe(normalized === 100);
      }),
      { numRuns: 100 },
    );
  });

  it('does not show the indicator for any normalized percentage below 100', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99 }), (percentage) => {
        expect(hasHundredPercentIndicator(toIntegerPercentage(percentage))).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
