import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { hashToken } from '../_lib/token.ts';
import { normalizeAndValidate } from '../_lib/validate.ts';
import type {
  ErrorResponse,
  RecordInput,
  RecordResult,
  SuccessResponse,
} from '../../src/features/demon-tier-tracker/types.ts';

/**
 * Records_API serverless handler — `POST /api/v1/records`.
 *
 * Implements the request lifecycle from the design's "Request Lifecycle
 * (Records_API)" sequence diagram with all-or-nothing semantics:
 *
 *   1. Only accept POST                              → 405 otherwise
 *   2. Size guard (raw body > 64 KB)                 → 413 payload_too_large
 *   3. Extract X-Player-Token (empty/>512 → missing) → 401 unauthorized
 *   4. Hash + resolve player within a ~2s budget     → 401 (no match) / 503 (timeout/down)
 *   5. Parse JSON + normalizeAndValidate             → 400 invalid_payload
 *   6. Pre-check every level exists in dtt_demons    → 400 unknown_level (persists nothing)
 *      then upsert_record per record                 → 500 persist_failed on DB error
 *   7. Success                                       → 200 SuccessResponse envelope
 *
 * Attribution is strictly by the validated token (Req 10.1): any `player_id`
 * present in the body is ignored — the authenticated player id is the only id
 * ever passed to the upsert RPC.
 *
 * The function keeps DB/IO thin and delegates pure payload logic to
 * `validate.ts` so the pipeline stays testable.
 *
 * _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 5.8, 6.6, 7.7, 10.1, 10.3, 10.4_
 */

/* -------------------------------------------------------------------------- */
/* Minimal, dependency-free Vercel Node request/response typings.             */
/* The repo does not depend on `@vercel/node`; these cover only what we use.  */
/* -------------------------------------------------------------------------- */

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  status(statusCode: number): VercelResponse;
  json(body: unknown): VercelResponse;
  setHeader(name: string, value: string): void;
  end(): VercelResponse;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Maximum raw body size: 64 kilobytes (Req 10.4). */
const MAX_BODY_BYTES = 64 * 1024;
/** Maximum accepted token length; longer is treated as missing (Req 5.2). */
const MAX_TOKEN_LENGTH = 512;
/** Token lookup budget; exceeding it yields a 503 (Req 5.3, 5.6). */
const AUTH_TIMEOUT_MS = 2000;

/** Sentinel returned when the auth lookup exceeds its time budget. */
const AUTH_TIMEOUT = Symbol('auth-timeout');

/* -------------------------------------------------------------------------- */
/* Small response helpers                                                     */
/* -------------------------------------------------------------------------- */

function sendError(
  res: VercelResponse,
  httpStatus: number,
  code: ErrorResponse['code'],
  message: string,
  extra?: { field?: string; index?: number },
): void {
  const body: ErrorResponse = { status: 'error', code, message, ...extra };
  res.status(httpStatus).json(body);
}

/**
 * Compute the raw body size in bytes. Prefers the `Content-Length` header (the
 * size as sent on the wire); falls back to measuring the parsed/string body.
 */
function rawBodyByteLength(req: VercelRequest): number {
  const headerValue = req.headers['content-length'];
  const contentLength = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof contentLength === 'string' && contentLength.length > 0) {
    const parsed = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  const { body } = req;
  if (typeof body === 'string') {
    return Buffer.byteLength(body, 'utf8');
  }
  if (body === undefined || body === null) {
    return 0;
  }
  // Body was already parsed to an object/array by the runtime; re-serialize to
  // approximate the on-the-wire size for the guard.
  try {
    return Buffer.byteLength(JSON.stringify(body), 'utf8');
  } catch {
    return 0;
  }
}

/**
 * Extract the Secret_Player_Token from the `X-Player-Token` header (Req 5.1).
 * Returns `null` when the token is absent, empty, or longer than 512 chars,
 * which the caller treats as "missing" (Req 5.2).
 */
function extractToken(req: VercelRequest): string | null {
  const raw = req.headers['x-player-token'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return null;
  }
  if (value.length === 0 || value.length > MAX_TOKEN_LENGTH) {
    return null;
  }
  return value;
}

/**
 * Parse the request body to a JSON value. Returns `{ ok: false }` when the body
 * is a string that is not valid JSON.
 */
function parseBody(body: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof body === 'string') {
    // An empty string body cannot be a valid record payload.
    if (body.trim().length === 0) {
      return { ok: true, value: undefined };
    }
    try {
      return { ok: true, value: JSON.parse(body) };
    } catch {
      return { ok: false };
    }
  }
  // The Vercel runtime parses `application/json` bodies into objects already.
  return { ok: true, value: body };
}

/* -------------------------------------------------------------------------- */
/* Auth: resolve the player id from the token within a 2s budget              */
/* -------------------------------------------------------------------------- */

type AuthOutcome =
  | { kind: 'ok'; playerId: string }
  | { kind: 'no_match' }
  | { kind: 'unavailable' };

async function resolvePlayer(tokenHash: string): Promise<AuthOutcome> {
  const lookup = supabaseAdmin
    .from('dtt_players')
    .select('id')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof AUTH_TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(AUTH_TIMEOUT), AUTH_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([lookup, timeout]);

    // Lookup did not return within the 2s budget (Req 5.6).
    if (result === AUTH_TIMEOUT) {
      return { kind: 'unavailable' };
    }

    const { data, error } = result;
    // Database error / unavailable → cannot complete auth (Req 5.6).
    if (error) {
      return { kind: 'unavailable' };
    }
    // No row hash-matches the token (Req 5.5).
    if (!data) {
      return { kind: 'no_match' };
    }
    return { kind: 'ok', playerId: (data as { id: string }).id };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Level allow-listing: ensure every level_id exists before any write         */
/* -------------------------------------------------------------------------- */

type LevelCheck =
  | { kind: 'ok' }
  | { kind: 'unknown'; index: number; levelId: string }
  | { kind: 'error' };

/**
 * Verify every record's `level_id` exists in `dtt_demons` BEFORE any upsert, so
 * an unknown level rejects the whole request and persists nothing (Req 10.3).
 */
async function checkLevelsExist(records: RecordInput[]): Promise<LevelCheck> {
  const uniqueLevelIds = [...new Set(records.map((r) => r.level_id))];

  const { data, error } = await supabaseAdmin
    .from('dtt_demons')
    .select('level_id')
    .in('level_id', uniqueLevelIds);

  if (error) {
    return { kind: 'error' };
  }

  const known = new Set((data ?? []).map((row) => (row as { level_id: string }).level_id));
  for (let index = 0; index < records.length; index += 1) {
    if (!known.has(records[index].level_id)) {
      return { kind: 'unknown', index, levelId: records[index].level_id };
    }
  }
  return { kind: 'ok' };
}

/* -------------------------------------------------------------------------- */
/* Postgres FK-violation detection (23503)                                    */
/* -------------------------------------------------------------------------- */

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23503'
  );
}

/* -------------------------------------------------------------------------- */
/* Handler                                                                    */
/* -------------------------------------------------------------------------- */

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // 1. Only POST is accepted.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendError(res, 405, 'invalid_payload', 'Method not allowed; use POST');
    return;
  }

  // 2. Size guard on the raw body (Req 10.4).
  if (rawBodyByteLength(req) > MAX_BODY_BYTES) {
    sendError(res, 413, 'payload_too_large', 'Body exceeds 64KB');
    return;
  }

  // 3. Extract token; empty or >512 chars is treated as missing (Req 5.1, 5.2).
  const token = extractToken(req);
  if (token === null) {
    sendError(res, 401, 'unauthorized', 'Invalid or missing player token');
    return;
  }

  // 4. Hash the token and resolve the player within the 2s budget (Req 5.3-5.8).
  const auth = await resolvePlayer(hashToken(token));
  if (auth.kind === 'unavailable') {
    sendError(res, 503, 'auth_unavailable', 'Could not validate token in time');
    return;
  }
  if (auth.kind === 'no_match') {
    sendError(res, 401, 'unauthorized', 'Invalid or missing player token');
    return;
  }
  const playerId = auth.playerId;

  // 5. Parse + normalize + validate the payload (Req 6.1-6.5, 7.4).
  const parsed = parseBody(req.body);
  if (!parsed.ok) {
    sendError(res, 400, 'invalid_payload', 'Request body is not valid JSON');
    return;
  }

  const validation = normalizeAndValidate(parsed.value);
  if (!validation.valid) {
    const { code, message, field, index } = validation.error;
    sendError(res, 400, code, message, { field, index });
    return;
  }
  const records = validation.records;

  // 6a. All-or-nothing level allow-listing before any write (Req 10.3).
  const levelCheck = await checkLevelsExist(records);
  if (levelCheck.kind === 'error') {
    sendError(res, 500, 'persist_failed', 'Record could not be stored');
    return;
  }
  if (levelCheck.kind === 'unknown') {
    sendError(res, 400, 'unknown_level', 'level_id not in demons', {
      field: 'level_id',
      index: levelCheck.index,
    });
    return;
  }

  // 6b. Upsert each record via the SECURITY DEFINER RPC, attributing strictly to
  //     the token's player id (Req 10.1, 7.x). Levels were pre-checked above, so
  //     a FK violation here is unexpected but still mapped to 400 unknown_level.
  const results: RecordResult[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const { data, error } = await supabaseAdmin.rpc('upsert_record', {
      p_player_id: playerId,
      p_level_id: record.level_id,
      p_percentage: record.percentage,
    });

    if (error) {
      if (isForeignKeyViolation(error)) {
        sendError(res, 400, 'unknown_level', 'level_id not in demons', {
          field: 'level_id',
          index,
        });
        return;
      }
      // Any other DB write failure (Req 7.7).
      sendError(res, 500, 'persist_failed', 'Record could not be stored');
      return;
    }

    // A TABLE-returning RPC yields an array of rows; take the single row.
    const row = (Array.isArray(data) ? data[0] : data) as
      | { stored_percentage: number; applied: boolean; inserted: boolean }
      | undefined;

    if (!row) {
      sendError(res, 500, 'persist_failed', 'Record could not be stored');
      return;
    }

    const result: RecordResult = {
      level_id: record.level_id,
      applied: row.applied,
      stored_percentage: Number(row.stored_percentage),
    };
    if (!row.applied) {
      result.reason = 'not_higher';
    }
    results.push(result);
  }

  // 7. Success envelope (Req 6.6).
  const success: SuccessResponse = {
    status: 'ok',
    processed: results.length,
    results,
  };
  res.status(200).json(success);
}
