/**
 * Demon Tier Tracker — shared TypeScript types.
 *
 * These types model the request payloads and response envelopes of the
 * Records_API (`POST /api/v1/records`) exactly as specified in the design
 * document's "API Payload Specification" section. They are shared between the
 * serverless function, its tests, and any client-side tooling.
 *
 * _Requirements: 6.1, 6.2, 6.3, 6.6_
 */

/**
 * A single submitted record, as sent by the Tracker_Mod.
 *
 * Both payload shapes use this object:
 * - Phase 1 (Initial Bulk Sync): a JSON array of 1..1000 `RecordInput`.
 * - Phase 2 (Live Single Update): a single `RecordInput` object.
 *
 * Any `player_id` present in the body is ignored; attribution is by token only
 * (Req 10.1).
 */
export interface RecordInput {
  /**
   * GD numeric level id as a string. Required, non-empty. Must exist in the
   * `demons` table (Req 10.3).
   */
  level_id: string;
  /**
   * Level name (1..255 chars). Used only for Phase 1 demon
   * bootstrapping/labeling; ignored for attribution.
   */
  level_name: string;
  /**
   * Best completion percentage. Required, numeric, 0..100 inclusive (Req 6.3).
   */
  percentage: number;
}

/**
 * The accepted request body: either a single record (Phase 2) or an array of
 * records (Phase 1).
 */
export type RecordPayload = RecordInput | RecordInput[];

/**
 * Result of validating a request payload.
 *
 * On success, `records` holds the normalized list (a single object is
 * normalized to a one-element array) in the order received. On failure, the
 * error envelope names the offending field/index where applicable.
 */
export type ValidationResult =
  | { valid: true; records: RecordInput[] }
  | { valid: false; error: ErrorResponse };

/**
 * Per-record outcome reported in a successful response.
 */
export interface RecordResult {
  /** The record's GD level id. */
  level_id: string;
  /** Whether the upsert changed the stored value (insert or higher update). */
  applied: boolean;
  /**
   * Reason the record was not applied, when `applied` is false
   * (e.g. `"not_higher"`).
   */
  reason?: string;
  /** The percentage currently stored after processing this record. */
  stored_percentage: number;
}

/**
 * Success response envelope (HTTP 200, Req 6.6).
 */
export interface SuccessResponse {
  status: 'ok';
  /** Number of records processed. */
  processed: number;
  /** Per-record outcomes, in the order the records were processed. */
  results: RecordResult[];
}

/**
 * Machine-readable error codes returned by the Records_API.
 */
export type ErrorCode =
  | 'unauthorized'
  | 'invalid_payload'
  | 'unknown_level'
  | 'payload_too_large'
  | 'auth_unavailable'
  | 'persist_failed';

/**
 * Error response envelope. The optional `field` and `index` identify the
 * offending field and array position for validation errors (Req 6.4, 6.5).
 */
export interface ErrorResponse {
  status: 'error';
  /** Machine-readable error code. */
  code: ErrorCode;
  /** Human-readable error message. */
  message: string;
  /** The field that failed validation, when applicable. */
  field?: string;
  /** The array index of the offending record, when applicable. */
  index?: number;
}

/**
 * The full set of response shapes the Records_API may return.
 */
export type ApiResponse = SuccessResponse | ErrorResponse;
