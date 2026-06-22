import { describe, expect, it } from 'vitest';
import { MAX_RECORDS, normalizeAndValidate } from './validate';
import type { RecordInput } from '../../src/features/demon-tier-tracker/types';

const rec = (overrides: Partial<RecordInput> = {}): RecordInput => ({
  level_id: '128',
  level_name: 'Theory of Everything 2',
  percentage: 100,
  ...overrides,
});

describe('normalizeAndValidate — normalization (Req 6.1, 6.2)', () => {
  it('normalizes a single record object to a one-element array', () => {
    const result = normalizeAndValidate(rec());
    expect(result).toEqual({ valid: true, records: [rec()] });
  });

  it('passes an array of records through in order', () => {
    const a = rec({ level_id: '1', percentage: 10 });
    const b = rec({ level_id: '2', percentage: 20 });
    const c = rec({ level_id: '3', percentage: 30 });
    const result = normalizeAndValidate([a, b, c]);
    expect(result).toEqual({ valid: true, records: [a, b, c] });
  });

  it('produces the same stored records for r and [r]', () => {
    const single = normalizeAndValidate(rec());
    const array = normalizeAndValidate([rec()]);
    expect(single).toEqual(array);
  });

  it('accepts the boundary array sizes 1 and MAX_RECORDS', () => {
    const one = normalizeAndValidate([rec({ level_id: 'x' })]);
    expect(one.valid).toBe(true);

    const max = Array.from({ length: MAX_RECORDS }, (_, i) => rec({ level_id: String(i) }));
    const result = normalizeAndValidate(max);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.records).toHaveLength(MAX_RECORDS);
  });

  it('accepts percentage boundaries 0 and 100', () => {
    expect(normalizeAndValidate(rec({ percentage: 0 })).valid).toBe(true);
    expect(normalizeAndValidate(rec({ percentage: 100 })).valid).toBe(true);
  });
});

describe('normalizeAndValidate — shape rejection (Req 6.5)', () => {
  it.each([
    ['null', null],
    ['a number', 42],
    ['a string', 'nope'],
    ['a boolean', true],
    ['undefined', undefined],
  ])('rejects %s with invalid_payload', (_label, value) => {
    const result = normalizeAndValidate(value);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe('invalid_payload');
      expect(result.error.field).toBeUndefined();
    }
  });

  it('rejects an empty array with invalid_payload', () => {
    const result = normalizeAndValidate([]);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.code).toBe('invalid_payload');
  });

  it('rejects an array larger than MAX_RECORDS', () => {
    const tooMany = Array.from({ length: MAX_RECORDS + 1 }, (_, i) =>
      rec({ level_id: String(i) }),
    );
    const result = normalizeAndValidate(tooMany);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.code).toBe('invalid_payload');
  });
});

describe('normalizeAndValidate — all-or-nothing field validation (Req 6.3, 6.4, 7.4)', () => {
  it('rejects a missing level_id and names the field/index', () => {
    const result = normalizeAndValidate([rec(), { level_name: 'x', percentage: 50 }]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.field).toBe('level_id');
      expect(result.error.index).toBe(1);
    }
  });

  it('rejects an empty-string level_id', () => {
    const result = normalizeAndValidate(rec({ level_id: '' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.field).toBe('level_id');
  });

  it('rejects a non-numeric percentage', () => {
    const result = normalizeAndValidate({ level_id: '1', level_name: 'a', percentage: '50' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.field).toBe('percentage');
  });

  it('rejects a NaN percentage', () => {
    const result = normalizeAndValidate(rec({ percentage: NaN }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.field).toBe('percentage');
  });

  it.each([-1, 101, 100.0001, -0.0001])('rejects out-of-range percentage %p', (p) => {
    const result = normalizeAndValidate(rec({ percentage: p }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.field).toBe('percentage');
      expect(result.error.index).toBe(0);
    }
  });

  it('rejects the whole batch when any record is invalid', () => {
    const batch = [rec({ level_id: '1' }), rec({ level_id: '2', percentage: 200 }), rec({ level_id: '3' })];
    const result = normalizeAndValidate(batch);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.index).toBe(1);
  });

  it('rejects a non-object element inside an array', () => {
    const result = normalizeAndValidate([rec(), 5]);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.index).toBe(1);
  });
});
