import type {
  ErrorResponse,
  RecordInput,
  ValidationResult,
} from '../../src/features/demon-tier-tracker/types';

/**
 * Payload normalization and validation for the Records_API.
 *
 * This is a pure function module (no network/DB access) so it can be exercised
 * directly by unit and property-based tests. It realizes the request-lifecycle
 * steps "4. Normalize body to Record[]" and "5. Validate shape, count(1..1000),
 * fields, percentage 0..100" from the design's request-lifecycle diagram, with
 * all-or-nothing semantics: if any single record is invalid the whole request
 * is rejected and nothing is persisted.
 *
 * _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.4_
 */

/** Minimum number of records allowed in an array payload (Req 6.2, 6.5). */
export const MIN_RECORDS = 1;
/** Maximum number of records allowed in an array payload (Req 6.2, 6.5). */
export const MAX_RECORDS = 1000;

/** Build an `invalid_payload` error for a malformed payload shape (Req 6.5). */
function payloadShapeError(message: string): ErrorResponse {
  return { status: 'error', code: 'invalid_payload', message };
}

/**
 * Build an `invalid_payload` error for a record field failure, naming the
 * offending field and the array index of the record (Req 6.4).
 */
function fieldError(message: string, field: string, index: number): ErrorResponse {
  return { status: 'error', code: 'invalid_payload', message, field, index };
}

/** True for a non-null, non-array object value. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a single candidate record at the given index. Returns an
 * `ErrorResponse` describing the first failure, or `null` when the record is
 * valid (non-empty string `level_id` and numeric `percentage` in [0, 100]).
 *
 * _Requirements: 6.3, 6.4, 7.4_
 */
function validateRecord(candidate: unknown, index: number): ErrorResponse | null {
  if (!isPlainObject(candidate)) {
    return fieldError('record must be an object', 'record', index);
  }

  const { level_id, percentage } = candidate;

  // level_id: required, non-empty string (Req 6.3, 6.4).
  if (typeof level_id !== 'string' || level_id.length === 0) {
    return fieldError('level_id must be a non-empty string', 'level_id', index);
  }

  // percentage: required, numeric (Req 6.3, 6.4).
  if (typeof percentage !== 'number' || !Number.isFinite(percentage)) {
    return fieldError('percentage must be a number', 'percentage', index);
  }

  // percentage: in range 0..100 inclusive (Req 6.3, 6.4, 7.4).
  if (percentage < 0 || percentage > 100) {
    return fieldError('percentage must be 0..100', 'percentage', index);
  }

  return null;
}

/**
 * Normalize and validate a raw request payload.
 *
 * Normalization (Req 6.1, 6.2):
 *   - a single record object is normalized to a one-element array;
 *   - an array is passed through unchanged.
 *
 * Rejection cases return an `ErrorResponse`:
 *   - a payload that is neither a single object nor an array, an empty array,
 *     or an array with more than {@link MAX_RECORDS} elements → `invalid_payload`
 *     identifying the payload (Req 6.5);
 *   - any record missing a required field, with a non-numeric percentage, or a
 *     percentage outside [0, 100] → rejects the whole request, naming the
 *     offending field and index (Req 6.4, 7.4).
 *
 * @param payload the parsed JSON request body
 * @returns a {@link ValidationResult} discriminated union
 */
export function normalizeAndValidate(payload: unknown): ValidationResult {
  let candidates: unknown[];

  if (Array.isArray(payload)) {
    // Array payload: enforce count 1..1000 inclusive (Req 6.2, 6.5).
    if (payload.length < MIN_RECORDS) {
      return { valid: false, error: payloadShapeError('payload array must not be empty') };
    }
    if (payload.length > MAX_RECORDS) {
      return {
        valid: false,
        error: payloadShapeError(`payload array must contain at most ${MAX_RECORDS} records`),
      };
    }
    candidates = payload;
  } else if (isPlainObject(payload)) {
    // Single record object → normalize to a one-element array (Req 6.1).
    candidates = [payload];
  } else {
    // Neither a single object nor an array (null, string, number, etc.) (Req 6.5).
    return {
      valid: false,
      error: payloadShapeError('payload must be a record object or an array of records'),
    };
  }

  // All-or-nothing validation: reject on the first invalid record (Req 6.4, 7.4).
  for (let index = 0; index < candidates.length; index += 1) {
    const error = validateRecord(candidates[index], index);
    if (error) {
      return { valid: false, error };
    }
  }

  // Every record is valid; return the normalized list in the order received.
  return { valid: true, records: candidates as RecordInput[] };
}
