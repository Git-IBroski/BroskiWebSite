import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { MAX_RECORDS, normalizeAndValidate } from './validate';
import type { RecordInput } from '../../src/features/demon-tier-tracker/types';

/**
 * Feature: demon-tier-tracker, Property 3: All-or-nothing validation
 *
 * For any request payload, the request is accepted only if every record has a
 * non-empty `level_id` and a numeric `percentage` in [0, 100]; if any record is
 * missing a required field, has a non-numeric percentage, or a percentage
 * outside [0, 100], the entire request is rejected with an `invalid_payload`
 * error that names the offending field, and persists nothing. At the
 * validation level this is observable as a `{ valid: false }` result carrying
 * an `error.code === 'invalid_payload'` with `error.field` set.
 *
 * Validates: Requirements 6.3, 6.4, 7.4
 */

/** Arbitrary for a fully valid record: non-empty level_id, numeric pct in [0,100]. */
const validRecordArb: fc.Arbitrary<RecordInput> = fc.record({
  level_id: fc.string({ minLength: 1 }).filter((s) => s.length > 0),
  level_name: fc.string({ minLength: 1, maxLength: 255 }),
  percentage: fc.double({ min: 0, max: 100, noNaN: true }),
});

/**
 * Arbitrary for an invalid record. Each variant violates exactly one of the
 * field rules so we can assert which field the error names.
 *  - missing level_id
 *  - empty level_id
 *  - non-numeric percentage (string / boolean / null)
 *  - NaN percentage
 *  - percentage < 0
 *  - percentage > 100
 */
type InvalidCase = { record: unknown; expectedField: string };

const invalidRecordArb: fc.Arbitrary<InvalidCase> = fc.oneof(
  // missing level_id entirely
  fc.record({
    level_name: fc.string({ maxLength: 255 }),
    percentage: fc.double({ min: 0, max: 100, noNaN: true }),
  }).map((r) => ({ record: r, expectedField: 'level_id' })),
  // empty level_id
  fc.record({
    level_id: fc.constant(''),
    level_name: fc.string({ maxLength: 255 }),
    percentage: fc.double({ min: 0, max: 100, noNaN: true }),
  }).map((r) => ({ record: r, expectedField: 'level_id' })),
  // non-numeric percentage
  fc.record({
    level_id: fc.string({ minLength: 1 }).filter((s) => s.length > 0),
    level_name: fc.string({ maxLength: 255 }),
    percentage: fc.oneof(
      fc.string(),
      fc.boolean(),
      fc.constant(null),
    ),
  }).map((r) => ({ record: r, expectedField: 'percentage' })),
  // NaN / non-finite percentage
  fc.record({
    level_id: fc.string({ minLength: 1 }).filter((s) => s.length > 0),
    level_name: fc.string({ maxLength: 255 }),
    percentage: fc.constantFrom(NaN, Infinity, -Infinity),
  }).map((r) => ({ record: r, expectedField: 'percentage' })),
  // out-of-range percentage (< 0 or > 100)
  fc.record({
    level_id: fc.string({ minLength: 1 }).filter((s) => s.length > 0),
    level_name: fc.string({ maxLength: 255 }),
    percentage: fc.oneof(
      fc.double({ min: -1e6, max: -0.0001, noNaN: true }),
      fc.double({ min: 100.0001, max: 1e6, noNaN: true }),
    ),
  }).map((r) => ({ record: r, expectedField: 'percentage' })),
);

describe('Property 3: All-or-nothing validation', () => {
  it('accepts an all-valid array of 1..MAX_RECORDS records', () => {
    fc.assert(
      fc.property(
        fc.array(validRecordArb, { minLength: 1, maxLength: 50 }),
        (records) => {
          const result = normalizeAndValidate(records);
          expect(result.valid).toBe(true);
          if (result.valid) {
            // Every record is preserved, in the order received.
            expect(result.records).toHaveLength(records.length);
          }
        },
      ),
    );
  });

  it('rejects any payload that mixes valid records with at least one invalid record, at any position', () => {
    fc.assert(
      fc.property(
        // a batch of valid records...
        fc.array(validRecordArb, { minLength: 0, maxLength: 20 }),
        // ...one guaranteed-invalid record...
        invalidRecordArb,
        // ...more valid records, and a chosen insertion point for the bad one.
        fc.array(validRecordArb, { minLength: 0, maxLength: 20 }),
        (before, invalid, after) => {
          const batch: unknown[] = [...before, invalid.record, ...after];
          // Keep within the array count bound so we exercise field validation,
          // not the count guard (Req 6.5 is covered separately).
          fc.pre(batch.length >= 1 && batch.length <= MAX_RECORDS);

          const result = normalizeAndValidate(batch);

          // Rejected as a whole — persists nothing (no `records` returned).
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error.code).toBe('invalid_payload');
            // Names the offending field.
            expect(result.error.field).toBeDefined();
            // The first failing record is the invalid one (everything before is
            // valid), so the named field matches its violation and the reported
            // index points at its position.
            expect(result.error.field).toBe(invalid.expectedField);
            expect(result.error.index).toBe(before.length);
          }
        },
      ),
    );
  });

  it('rejects a single invalid record object (Phase 2 shape) naming its field', () => {
    fc.assert(
      fc.property(invalidRecordArb, (invalid) => {
        const result = normalizeAndValidate(invalid.record);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.code).toBe('invalid_payload');
          expect(result.error.field).toBe(invalid.expectedField);
          expect(result.error.index).toBe(0);
        }
      }),
    );
  });
});
