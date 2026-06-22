import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { normalizeAndValidate, MAX_RECORDS } from './validate';
import type { RecordInput } from '../../src/features/demon-tier-tracker/types';

/**
 * Property 2: Payload normalization equivalence
 *
 * Feature: demon-tier-tracker, Property 2: Payload normalization equivalence —
 * for any valid record object `r`, processing the single-object payload `r`
 * produces the same stored result as processing the singleton array `[r]`; and
 * for any valid array of 1..1000 records, every record is processed in the
 * order received.
 *
 * Validates: Requirements 6.1, 6.2
 */

/**
 * Arbitrary for a valid {@link RecordInput}:
 *   - `level_id`: non-empty string,
 *   - `level_name`: string (Req allows 1..255; any string is fine for this
 *     normalization property since `level_name` is not validated here),
 *   - `percentage`: an integer or fractional number in [0, 100].
 */
const validRecordArb: fc.Arbitrary<RecordInput> = fc.record({
  level_id: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.length > 0),
  level_name: fc.string({ maxLength: 50 }),
  percentage: fc.oneof(
    fc.integer({ min: 0, max: 100 }),
    fc.float({ min: 0, max: 100, noNaN: true }),
  ),
});

describe('Property 2: Payload normalization equivalence', () => {
  it('processes single object `r` identically to the singleton array `[r]`', () => {
    fc.assert(
      fc.property(validRecordArb, (r) => {
        const single = normalizeAndValidate(r);
        const array = normalizeAndValidate([r]);

        // Both must be accepted.
        expect(single.valid).toBe(true);
        expect(array.valid).toBe(true);

        // And produce the same normalized result: { valid: true, records: [r] }.
        expect(single).toEqual(array);
        if (single.valid) {
          expect(single.records).toEqual([r]);
        }
      }),
    );
  });

  it('processes any valid array of 1..1000 records in the order received', () => {
    fc.assert(
      fc.property(
        fc.array(validRecordArb, { minLength: 1, maxLength: MAX_RECORDS }),
        (records) => {
          const result = normalizeAndValidate(records);

          expect(result.valid).toBe(true);
          if (result.valid) {
            // Order preserved and no records added/dropped.
            expect(result.records).toEqual(records);
            expect(result.records.length).toBe(records.length);
            result.records.forEach((rec, i) => {
              expect(rec).toBe(records[i]);
            });
          }
        },
      ),
    );
  });
});
