import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Feature: demon-tier-tracker, Property 5: Attribution invariance
 *
 * For any authenticated request and any `player_id` value supplied in the
 * payload (a forged id, another player's id, or none), every persisted record
 * is attributed to the player identified by the validated token and never to
 * the payload-supplied id.
 *
 * Strategy: the Records_API handler is exercised end-to-end with a mocked
 * service-role client (`../_lib/supabaseAdmin`). The fake admin client:
 *   (a) resolves the token lookup to a FIXED authenticated player id;
 *   (b) reports every requested `level_id` as a known demon (so allow-listing
 *       passes and the request reaches the upsert step);
 *   (c) captures the args of every `.rpc('upsert_record', ...)` call.
 * We then drive random payloads (single object and arrays) that each embed a
 * RANDOM, DIFFERENT `player_id`, and assert that every captured RPC call used
 * `p_player_id === AUTH_PLAYER_ID` — never the payload's `player_id`.
 *
 * Validates: Requirements 10.1
 */

/** The id the (mocked) token lookup always resolves to. */
const AUTH_PLAYER_ID = 'AUTH-PLAYER';

/** Captured `.rpc('upsert_record', args)` calls across the test run. */
interface CapturedRpc {
  fn: string;
  args: { p_player_id: string; p_level_id: string; p_percentage: number };
}
const rpcCalls: CapturedRpc[] = [];

// Mock the service-role Supabase client used by the handler. The handler
// imports it as `../_lib/supabaseAdmin.ts`; the mock factory below replaces it
// with a deterministic fake (no real DB / network).
vi.mock('../_lib/supabaseAdmin.ts', () => {
  const supabaseAdmin = {
    from(table: string) {
      if (table === 'dtt_players') {
        // (a) token lookup → fixed authenticated player id.
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: () =>
            Promise.resolve({ data: { id: AUTH_PLAYER_ID }, error: null }),
        };
        return chain;
      }
      if (table === 'dtt_demons') {
        // (b) every requested level_id is reported as a known demon.
        const chain = {
          select: () => chain,
          in: (_column: string, ids: string[]) =>
            Promise.resolve({
              data: ids.map((id) => ({ level_id: id })),
              error: null,
            }),
        };
        return chain;
      }
      throw new Error(`unexpected table in mock: ${table}`);
    },
    // (c) capture every upsert_record RPC call and report it as applied.
    rpc(fn: string, args: CapturedRpc['args']) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({
        data: [
          {
            stored_percentage: args.p_percentage,
            applied: true,
            inserted: true,
          },
        ],
        error: null,
      });
    },
  };
  return { supabaseAdmin };
});

// Import the handler AFTER registering the mock so it binds to the fake client.
const { default: handler } = await import('./records.ts');

/* -------------------------------------------------------------------------- */
/* Minimal fake Vercel request/response objects.                              */
/* -------------------------------------------------------------------------- */

interface CapturedResponse {
  statusCode: number;
  body: unknown;
}

function makeRes(): { res: any; captured: CapturedResponse } {
  const captured: CapturedResponse = { statusCode: 0, body: undefined };
  const res: any = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    json(body: unknown) {
      captured.body = body;
      return res;
    },
    setHeader() {},
    end() {
      return res;
    },
  };
  return { res, captured };
}

function makeReq(token: string, body: unknown): any {
  return {
    method: 'POST',
    headers: { 'x-player-token': token },
    body,
  };
}

/* -------------------------------------------------------------------------- */
/* Arbitraries                                                                */
/* -------------------------------------------------------------------------- */

/** A valid record carrying a RANDOM, forged `player_id` that must be ignored. */
const recordWithForgedPlayerArb = fc.record({
  player_id: fc.oneof(
    fc.uuid(),
    fc.string({ minLength: 1, maxLength: 40 }),
    fc.integer().map((n) => `player-${n}`),
  ),
  level_id: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.length > 0),
  level_name: fc.string({ minLength: 1, maxLength: 60 }),
  percentage: fc.double({ min: 0, max: 100, noNaN: true }),
});

/** A valid record with NO `player_id` field at all. */
const recordWithoutPlayerArb = fc.record({
  level_id: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.length > 0),
  level_name: fc.string({ minLength: 1, maxLength: 60 }),
  percentage: fc.double({ min: 0, max: 100, noNaN: true }),
});

/** A non-empty token (1..512 chars) so auth proceeds to the lookup. */
const tokenArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.length > 0);

describe('Property 5: Attribution invariance', () => {
  beforeEach(() => {
    rpcCalls.length = 0;
  });

  it('attributes every upsert to the token player, ignoring forged payload player_id (single + array)', async () => {
    await fc.assert(
      fc.asyncProperty(
        tokenArb,
        // Payload is either a single record object or an array of records,
        // each embedding a random/forged player_id.
        fc.oneof(
          recordWithForgedPlayerArb,
          fc.array(recordWithForgedPlayerArb, { minLength: 1, maxLength: 12 }),
        ),
        async (token, payload) => {
          rpcCalls.length = 0;
          const { res, captured } = makeRes();
          await handler(makeReq(token, payload), res);

          // The request reached persistence successfully.
          expect(captured.statusCode).toBe(200);

          const records = Array.isArray(payload) ? payload : [payload];
          // One upsert per record, in order.
          expect(rpcCalls).toHaveLength(records.length);

          for (let i = 0; i < rpcCalls.length; i += 1) {
            // Always attributed to the validated-token player...
            expect(rpcCalls[i].fn).toBe('upsert_record');
            expect(rpcCalls[i].args.p_player_id).toBe(AUTH_PLAYER_ID);
            // ...never the payload-supplied (forged) player_id.
            expect(rpcCalls[i].args.p_player_id).not.toBe(records[i].player_id);
          }
        },
      ),
    );
  });

  it('attributes upserts to the token player even when payload omits player_id', async () => {
    await fc.assert(
      fc.asyncProperty(
        tokenArb,
        fc.oneof(
          recordWithoutPlayerArb,
          fc.array(recordWithoutPlayerArb, { minLength: 1, maxLength: 12 }),
        ),
        async (token, payload) => {
          rpcCalls.length = 0;
          const { res, captured } = makeRes();
          await handler(makeReq(token, payload), res);

          expect(captured.statusCode).toBe(200);

          const records = Array.isArray(payload) ? payload : [payload];
          expect(rpcCalls).toHaveLength(records.length);
          for (const call of rpcCalls) {
            expect(call.args.p_player_id).toBe(AUTH_PLAYER_ID);
          }
        },
      ),
    );
  });
});
