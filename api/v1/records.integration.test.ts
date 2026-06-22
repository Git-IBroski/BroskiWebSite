import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Task 4.12 — Integration tests for the Records_API endpoint
 * (`POST /api/v1/records`).
 *
 * These are end-to-end, integration-style tests that drive the REAL handler
 * exported from `./records.ts` through its full request pipeline (size guard →
 * token extraction → auth lookup → payload validation → level allow-listing →
 * per-record upsert → success envelope).
 *
 * The design's Testing Strategy describes this as "End-to-end POST through
 * /api/v1/records against a Supabase test project: success, 401, 400, 413, 503
 * paths (Req 5.3, 5.6, 7.7)". A live Supabase test project is not available in
 * this CI/sandbox environment, so the only seam mocked is the server-only
 * Supabase service client (`../_lib/supabaseAdmin`). Everything else — token
 * hashing, JSON parsing, normalization/validation, the 64KB guard, the 2s auth
 * budget, FK/persist error mapping, and the response envelope — is the actual
 * production code path. Each DB scenario is simulated deterministically so the
 * five HTTP outcomes (200 / 401 / 400 / 413 / 503) plus the 7.7 persist-failed
 * (500) path are exercised reproducibly.
 *
 * _Requirements: 5.3, 5.6, 7.7_
 */

/* -------------------------------------------------------------------------- */
/* Mock state + supabaseAdmin mock (the single DB seam)                       */
/* -------------------------------------------------------------------------- */

// Controllable mock state, hoisted so it is available inside the vi.mock factory.
const mocks = vi.hoisted(() => {
  const state = {
    /** Row returned by the dtt_players token lookup (null = no match / 401). */
    playerRow: null as { id: string } | null,
    /** Error returned by the dtt_players token lookup (truthy → 503). */
    playerError: null as unknown,
    /** When true, the player lookup never resolves (drives the 2s timeout → 503). */
    playerHang: false,
    /** level_ids considered present in dtt_demons. */
    knownLevelIds: new Set<string>(),
    /** Error returned by the dtt_demons existence check. */
    demonsError: null as unknown,
    /** rpc('upsert_record') implementation; receives the rpc args. */
    rpcImpl: (_args: { p_player_id: string; p_level_id: string; p_percentage: number }) =>
      ({ data: null as unknown, error: null as unknown }),
  };
  return { state };
});

// Fake supabaseAdmin: minimal chainable surface matching what records.ts uses.
vi.mock('../_lib/supabaseAdmin.ts', () => {
  const { state } = mocks;

  const supabaseAdmin = {
    from(table: string) {
      if (table === 'dtt_players') {
        // .select('id').eq('token_hash', hash).maybeSingle()
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: () => {
            if (state.playerHang) {
              // A promise that never settles → forces the handler's 2s race to
              // resolve via its timeout branch (Req 5.6).
              return new Promise(() => {});
            }
            return Promise.resolve({ data: state.playerRow, error: state.playerError });
          },
        };
        return chain;
      }
      if (table === 'dtt_demons') {
        // .select('level_id').in('level_id', ids)
        const chain = {
          select: () => chain,
          in: async (_column: string, ids: string[]) => {
            if (state.demonsError) {
              return { data: null, error: state.demonsError };
            }
            const data = ids
              .filter((id) => state.knownLevelIds.has(id))
              .map((id) => ({ level_id: id }));
            return { data, error: null };
          },
        };
        return chain;
      }
      throw new Error(`unexpected table in mock: ${table}`);
    },
    rpc: async (
      _name: string,
      args: { p_player_id: string; p_level_id: string; p_percentage: number },
    ) => state.rpcImpl(args),
  };

  return { supabaseAdmin };
});

// Import the handler AFTER the mock is registered.
const { default: handler } = await import('./records.ts');

/* -------------------------------------------------------------------------- */
/* Minimal req/res test doubles                                               */
/* -------------------------------------------------------------------------- */

interface MockRes {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
  setHeader(name: string, value: string): void;
  end(): MockRes;
}

function createRes(): MockRes {
  const res: MockRes = {
    statusCode: 0,
    body: undefined,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end() {
      return this;
    },
  };
  return res;
}

function createReq(overrides: {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}) {
  return {
    method: 'POST',
    headers: {},
    body: undefined,
    ...overrides,
  } as { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
}

/** A single valid record object payload (Phase 2 live update shape). */
function validRecord(levelId = '128', percentage = 87) {
  return { level_id: levelId, level_name: 'Theory of Everything 2', percentage };
}

/** Track every upsert_record RPC invocation so we can assert persistence. */
let rpcCalls: Array<{ p_player_id: string; p_level_id: string; p_percentage: number }> = [];

/* -------------------------------------------------------------------------- */
/* Test setup                                                                 */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  // Clean baseline before each scenario.
  mocks.state.playerRow = null;
  mocks.state.playerError = null;
  mocks.state.playerHang = false;
  mocks.state.knownLevelIds = new Set<string>();
  mocks.state.demonsError = null;
  rpcCalls = [];
  mocks.state.rpcImpl = (args) => {
    rpcCalls.push(args);
    return { data: null, error: null };
  };
});

afterEach(() => {
  vi.useRealTimers();
});

/* -------------------------------------------------------------------------- */
/* 200 — success path                                                         */
/* -------------------------------------------------------------------------- */

describe('200 success path — Req 5.3', () => {
  it('authenticated token + known level + applied upsert yields a 200 success envelope', async () => {
    mocks.state.playerRow = { id: 'player-200' };
    mocks.state.knownLevelIds = new Set(['128']);
    mocks.state.rpcImpl = (args) => {
      rpcCalls.push(args);
      return {
        data: [{ stored_percentage: args.p_percentage, applied: true, inserted: true }],
        error: null,
      };
    };

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: validRecord('128', 87),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      processed: 1,
      results: [{ level_id: '128', applied: true, stored_percentage: 87 }],
    });
    // End-to-end: the record was attributed to the token's player and persisted.
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]).toMatchObject({ p_player_id: 'player-200', p_level_id: '128' });
  });

  it('processes a multi-record array payload end-to-end in order (200)', async () => {
    mocks.state.playerRow = { id: 'player-200' };
    mocks.state.knownLevelIds = new Set(['1', '2']);
    mocks.state.rpcImpl = (args) => {
      rpcCalls.push(args);
      return {
        data: [{ stored_percentage: args.p_percentage, applied: true, inserted: true }],
        error: null,
      };
    };

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: [validRecord('1', 50), validRecord('2', 100)],
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', processed: 2 });
    expect(rpcCalls.map((c) => c.p_level_id)).toEqual(['1', '2']);
  });
});

/* -------------------------------------------------------------------------- */
/* 401 — unauthorized                                                         */
/* -------------------------------------------------------------------------- */

describe('401 unauthorized path', () => {
  it('returns 401 and persists nothing when the token matches no player', async () => {
    mocks.state.playerRow = null; // no row hash-matches the token
    mocks.state.knownLevelIds = new Set(['128']);

    const req = createReq({
      headers: { 'x-player-token': 'unknown-token' },
      body: validRecord('128', 87),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ status: 'error', code: 'unauthorized' });
    expect(rpcCalls).toHaveLength(0);
  });

  it('returns 401 when the X-Player-Token header is missing entirely', async () => {
    const req = createReq({ headers: {}, body: validRecord() });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ status: 'error', code: 'unauthorized' });
    expect(rpcCalls).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 400 — invalid payload / unknown level                                      */
/* -------------------------------------------------------------------------- */

describe('400 invalid payload path', () => {
  it('returns 400 invalid_payload for an out-of-range percentage and persists nothing', async () => {
    mocks.state.playerRow = { id: 'player-400' };
    mocks.state.knownLevelIds = new Set(['128']);

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: { level_id: '128', level_name: 'X', percentage: 150 }, // out of 0..100
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      status: 'error',
      code: 'invalid_payload',
      field: 'percentage',
    });
    expect(rpcCalls).toHaveLength(0);
  });

  it('returns 400 unknown_level when a level_id is not in the demons allow-list', async () => {
    mocks.state.playerRow = { id: 'player-400' };
    mocks.state.knownLevelIds = new Set<string>(); // nothing is known

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: validRecord('99999999', 87),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      status: 'error',
      code: 'unknown_level',
      field: 'level_id',
      index: 0,
    });
    // Allow-listing happens before any write (Req 10.3): nothing persisted.
    expect(rpcCalls).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 413 — payload too large                                                    */
/* -------------------------------------------------------------------------- */

describe('413 payload too large path — Req 10.4', () => {
  it('returns 413 when Content-Length exceeds 64KB and never touches the DB', async () => {
    const req = createReq({
      headers: {
        'x-player-token': 'valid-token',
        'content-length': String(64 * 1024 + 1),
      },
      body: validRecord(),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(413);
    expect(res.body).toMatchObject({ status: 'error', code: 'payload_too_large' });
    // The guard runs before auth/persistence.
    expect(rpcCalls).toHaveLength(0);
  });

  it('admits a body at exactly 64KB (boundary, not over)', async () => {
    mocks.state.playerRow = { id: 'player-200' };
    mocks.state.knownLevelIds = new Set(['128']);
    mocks.state.rpcImpl = (args) => {
      rpcCalls.push(args);
      return {
        data: [{ stored_percentage: args.p_percentage, applied: true, inserted: true }],
        error: null,
      };
    };

    const req = createReq({
      headers: {
        'x-player-token': 'valid-token',
        'content-length': String(64 * 1024), // exactly at the limit → admitted
      },
      body: validRecord('128', 87),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
  });
});

/* -------------------------------------------------------------------------- */
/* 503 — auth unavailable (Req 5.6)                                           */
/* -------------------------------------------------------------------------- */

describe('503 auth_unavailable path — Req 5.6', () => {
  it('returns 503 when the player lookup errors (DB unavailable) and persists nothing', async () => {
    mocks.state.playerError = { message: 'connection reset', code: '08006' };

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: validRecord('128', 87),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', code: 'auth_unavailable' });
    expect(rpcCalls).toHaveLength(0);
  });

  it('returns 503 when the auth lookup exceeds the 2s budget (timeout)', async () => {
    vi.useFakeTimers();
    mocks.state.playerHang = true; // lookup never resolves → 2s timeout wins

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: validRecord('128', 87),
    });
    const res = createRes();

    const pending = handler(req as never, res as never);
    // Advance past the 2000ms auth budget, flushing the timeout + microtasks.
    await vi.advanceTimersByTimeAsync(2000);
    await pending;

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', code: 'auth_unavailable' });
    expect(rpcCalls).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 500 — persist_failed (Req 7.7)                                             */
/* -------------------------------------------------------------------------- */

describe('500 persist_failed path — Req 7.7', () => {
  it('returns 500 persist_failed when the upsert RPC fails with a non-FK DB error', async () => {
    mocks.state.playerRow = { id: 'player-500' };
    mocks.state.knownLevelIds = new Set(['128']);
    mocks.state.rpcImpl = (args) => {
      rpcCalls.push(args);
      // A generic write failure (NOT a 23503 FK violation) → persist_failed.
      return { data: null, error: { message: 'deadlock detected', code: '40P01' } };
    };

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: validRecord('128', 87),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ status: 'error', code: 'persist_failed' });
    // The write was attempted (the failure occurred during persistence).
    expect(rpcCalls).toHaveLength(1);
  });
});
