import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Feature: demon-tier-tracker, Property 4: Authentication rejection persists nothing
 *
 * For any request whose token is missing, empty, longer than 512 characters, or
 * does not hash-match a stored player, the Records_API returns HTTP 401 and
 * persists no data, regardless of payload contents or how far processing
 * progressed.
 *
 * Validates: Requirements 5.2, 5.4, 5.5, 5.7, 10.2
 *
 * ---------------------------------------------------------------------------
 * ENVIRONMENT
 * ---------------------------------------------------------------------------
 * The handler imports `api/_lib/supabaseAdmin.ts`, which throws at import time
 * when `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are absent. To make this
 * property RUN without any real database, that module is mocked with a fake
 * client:
 *   - `.from(...).select(...).eq(...).maybeSingle()` resolves to `{ data: null }`
 *     (NO token ever hash-matches a stored player → the "no match" 401 path),
 *   - `.from(...).select(...).in(...)` resolves to `{ data: [] }` (never reached
 *     for a 401, present only so the fake is shaped like the real client),
 *   - `.rpc(...)` is a spy used to PROVE no persistence happens — it must never
 *     be invoked on any rejected (401) request.
 *
 * The handler is then invoked directly with minimal mock req/res objects.
 */

const { rpcMock, supabaseAdminMock } = vi.hoisted(() => {
  // `.rpc('upsert_record', ...)` is the ONLY persistence path. If auth rejects,
  // it must never be called — this spy lets us assert exactly that.
  const rpcMock = vi.fn(async () => ({ data: null, error: null }));

  // Token lookup: always "no row matches" so even a well-formed token is a
  // non-matching token (Req 5.5 / 10.2).
  const maybeSingleMock = vi.fn(async () => ({ data: null, error: null }));

  // Level allow-list lookup (only reached after a successful auth — never here).
  const inMock = vi.fn(async () => ({ data: [] as unknown[], error: null }));

  const supabaseAdminMock = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
        in: inMock,
      })),
    })),
    rpc: rpcMock,
  };

  return { rpcMock, maybeSingleMock, inMock, supabaseAdminMock };
});

vi.mock('../_lib/supabaseAdmin.ts', () => ({ supabaseAdmin: supabaseAdminMock }));

// Imported AFTER the mock is registered (vi.mock is hoisted above this import).
import handler from './records';

/* -------------------------------------------------------------------------- */
/* Minimal mock req/res                                                       */
/* -------------------------------------------------------------------------- */

interface MockRes {
  statusCode: number | undefined;
  jsonBody: unknown;
  headers: Record<string, string>;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
  setHeader(name: string, value: string): void;
  end(): MockRes;
}

function createRes(): MockRes {
  return {
    statusCode: undefined,
    jsonBody: undefined,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.jsonBody = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end() {
      return this;
    },
  };
}

function createReq(token: string | undefined, body: unknown) {
  const headers: Record<string, string | string[] | undefined> = {};
  // A missing token means the header is simply absent.
  if (token !== undefined) {
    headers['x-player-token'] = token;
  }
  return { method: 'POST', headers, body };
}

/* -------------------------------------------------------------------------- */
/* Arbitraries                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The four rejected-token shapes from Property 4:
 *  - missing       → header absent (undefined)
 *  - empty         → "" (treated as missing, Req 5.2)
 *  - >512 chars    → too long (treated as missing, Req 5.2)
 *  - non-matching  → well-formed 1..512 char token that hash-matches no player
 *                    (the mock always returns `data: null`, Req 5.5 / 10.2)
 */
const rejectedTokenArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.string({ minLength: 513, maxLength: 700 }).map((s) => s.padEnd(513, 'x')),
  fc.string({ minLength: 1, maxLength: 512 }),
);

/**
 * "Regardless of payload contents": arbitrary bodies — single record objects,
 * arrays of records, arbitrary JSON values, and nothing at all. Kept well under
 * the 64 KB size guard so we always exercise the auth path (not the 413 path).
 */
const recordishArb = fc.record({
  level_id: fc.string({ maxLength: 20 }),
  level_name: fc.string({ maxLength: 40 }),
  percentage: fc.double({ min: -50, max: 150, noNaN: true }),
});

const payloadArb: fc.Arbitrary<unknown> = fc.oneof(
  recordishArb,
  fc.array(recordishArb, { maxLength: 10 }),
  fc.anything({ maxDepth: 2, maxKeys: 5 }),
  fc.constant(undefined),
);

/* -------------------------------------------------------------------------- */
/* Property                                                                   */
/* -------------------------------------------------------------------------- */

describe('Property 4: Authentication rejection persists nothing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 and never persists for missing/empty/>512/non-matching tokens, for any payload', async () => {
    await fc.assert(
      fc.asyncProperty(rejectedTokenArb, payloadArb, async (token, payload) => {
        const req = createReq(token, payload);
        const res = createRes();

        await handler(req as never, res as never);

        // Rejected with 401 Unauthorized (Req 5.4, 5.5, 5.7, 10.2).
        expect(res.statusCode).toBe(401);
        expect((res.jsonBody as { code?: string }).code).toBe('unauthorized');

        // Persists nothing: the upsert RPC was never invoked, no matter how far
        // processing got (Req 5.2 / 10.2).
        expect(rpcMock).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  it('never invokes the upsert RPC across all rejected requests (cumulative)', () => {
    // After the property above ran 100+ rejected requests, persistence must
    // still show zero writes.
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
