import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Task 4.11 — Example unit tests for the Records_API (`POST /api/v1/records`).
 *
 * These are example/edge-case unit tests (NOT property-based). They exercise the
 * handler's request pipeline in isolation by mocking the server-only Supabase
 * service client (`../_lib/supabaseAdmin`) so they run without a real database.
 *
 * Covered behaviors (Testing Strategy → "Example & Edge-Case Unit Tests"):
 *   - Header token extraction (Req 5.1): X-Player-Token present / absent /
 *     array / longer than 512 chars.
 *   - Valid-token proceed-to-processing (Req 5.8): a matching token leads past
 *     authentication into payload processing and persistence.
 *   - updated_at advances on an applied upsert (Req 8.4): the success result
 *     reflects an applied upsert (applied + stored_percentage), demonstrating
 *     the timestamp-advancing path. The literal timestamp advance (now()) is set
 *     inside the DB RPC and is verified at the DB level by the integration tests
 *     (tasks 2.5 / 2.7); here we assert the RPC contract that drives it.
 *
 * _Requirements: 5.1, 5.8, 8.4_
 */

/* -------------------------------------------------------------------------- */
/* Mock state + supabaseAdmin mock                                            */
/* -------------------------------------------------------------------------- */

// Controllable mock state, hoisted so it is available inside the vi.mock factory.
const mocks = vi.hoisted(() => {
  const state = {
    /** Row returned by the dtt_players token lookup (null = no match). */
    playerRow: null as { id: string } | null,
    /** Error returned by the dtt_players token lookup. */
    playerError: null as unknown,
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
          maybeSingle: async () => ({ data: state.playerRow, error: state.playerError }),
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

/* -------------------------------------------------------------------------- */
/* Test setup                                                                 */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  // Reset to a clean, authenticated-by-default baseline before each test.
  mocks.state.playerRow = null;
  mocks.state.playerError = null;
  mocks.state.knownLevelIds = new Set<string>();
  mocks.state.demonsError = null;
  mocks.state.rpcImpl = () => ({ data: null, error: null });
});

/* -------------------------------------------------------------------------- */
/* Header token extraction (Req 5.1)                                          */
/* -------------------------------------------------------------------------- */

describe('Header token extraction — Req 5.1', () => {
  it('rejects with 401 when the X-Player-Token header is absent', async () => {
    const req = createReq({ headers: {}, body: validRecord() });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ status: 'error', code: 'unauthorized' });
  });

  it('rejects with 401 when the X-Player-Token header is an empty string', async () => {
    const req = createReq({ headers: { 'x-player-token': '' }, body: validRecord() });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ status: 'error', code: 'unauthorized' });
  });

  it('rejects with 401 when the X-Player-Token exceeds 512 characters', async () => {
    // 513 chars → treated as missing (Req 5.2) and never sent to the DB lookup.
    mocks.state.playerRow = { id: 'player-1' };
    const req = createReq({
      headers: { 'x-player-token': 'a'.repeat(513) },
      body: validRecord(),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ status: 'error', code: 'unauthorized' });
  });

  it('extracts the first value when X-Player-Token is provided as an array and proceeds past auth', async () => {
    // A matching player + known level + applied upsert lets us prove the header
    // was extracted (the request progressed to a 200, not a 401).
    mocks.state.playerRow = { id: 'player-1' };
    mocks.state.knownLevelIds = new Set(['128']);
    mocks.state.rpcImpl = (args) => ({
      data: [{ stored_percentage: args.p_percentage, applied: true, inserted: true }],
      error: null,
    });

    const req = createReq({
      headers: { 'x-player-token': ['valid-token', 'ignored-second'] },
      body: validRecord('128', 87),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', processed: 1 });
  });
});

/* -------------------------------------------------------------------------- */
/* Valid-token proceed-to-processing (Req 5.8)                                */
/* -------------------------------------------------------------------------- */

describe('Valid-token proceed-to-processing — Req 5.8', () => {
  it('a matching token proceeds into payload processing and persists the record (200)', async () => {
    mocks.state.playerRow = { id: 'player-42' };
    mocks.state.knownLevelIds = new Set(['9876543']);
    const seen: Array<{ p_player_id: string; p_level_id: string; p_percentage: number }> = [];
    mocks.state.rpcImpl = (args) => {
      seen.push(args);
      return {
        data: [{ stored_percentage: args.p_percentage, applied: true, inserted: true }],
        error: null,
      };
    };

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: validRecord('9876543', 87),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      processed: 1,
      results: [{ level_id: '9876543', applied: true, stored_percentage: 87 }],
    });
    // Proof it reached persistence and attributed by the validated token (Req 5.8, 10.1).
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ p_player_id: 'player-42', p_level_id: '9876543' });
  });

  it('a matching token proceeds past auth into payload validation (400 on bad payload, not 401)', async () => {
    // With a valid token, an invalid payload must surface a validation error,
    // demonstrating the request advanced past authentication into processing.
    mocks.state.playerRow = { id: 'player-42' };

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: { level_id: '128', level_name: 'X', percentage: 150 }, // out of range
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ status: 'error', code: 'invalid_payload', field: 'percentage' });
  });
});

/* -------------------------------------------------------------------------- */
/* updated_at advances on an applied upsert (Req 8.4)                         */
/* -------------------------------------------------------------------------- */

describe('updated_at advances on an applied upsert — Req 8.4', () => {
  it('an applied upsert returns applied:true with the stored percentage (timestamp-advancing path)', async () => {
    // The DB RPC sets updated_at = now() exactly when an upsert is applied. At
    // the API level we assert the RPC contract that drives that advance:
    // applied:true + the stored percentage. The literal timestamp advance is
    // verified by the DB integration tests (tasks 2.5 / 2.7).
    mocks.state.playerRow = { id: 'player-1' };
    mocks.state.knownLevelIds = new Set(['44622744']);
    mocks.state.rpcImpl = (args) => ({
      data: [{ stored_percentage: args.p_percentage, applied: true, inserted: false }],
      error: null,
    });

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: validRecord('44622744', 73),
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = res.body as { results: Array<{ applied: boolean; stored_percentage: number; reason?: string }> };
    expect(body.results[0].applied).toBe(true);
    expect(body.results[0].stored_percentage).toBe(73);
    // An applied upsert carries no "not_higher" reason.
    expect(body.results[0].reason).toBeUndefined();
  });

  it('an equal-or-lower (not-higher) upsert reports applied:false and does NOT advance (no-op path)', async () => {
    // The complementary case: the RPC's higher-only guard makes this a no-op, so
    // updated_at is NOT advanced. The API reflects this with applied:false +
    // reason "not_higher", retaining the previously stored percentage (Req 7.3).
    mocks.state.playerRow = { id: 'player-1' };
    mocks.state.knownLevelIds = new Set(['128']);
    mocks.state.rpcImpl = () => ({
      data: [{ stored_percentage: 100, applied: false, inserted: false }],
      error: null,
    });

    const req = createReq({
      headers: { 'x-player-token': 'valid-token' },
      body: validRecord('128', 80), // lower than the stored 100
    });
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = res.body as { results: Array<{ applied: boolean; stored_percentage: number; reason?: string }> };
    expect(body.results[0].applied).toBe(false);
    expect(body.results[0].reason).toBe('not_higher');
    expect(body.results[0].stored_percentage).toBe(100);
  });
});
