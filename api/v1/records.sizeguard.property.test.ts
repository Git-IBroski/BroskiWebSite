import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Property 7: Payload size guard.
 *
 * For any request body, if its size exceeds 64 kilobytes the Records_API
 * returns HTTP 413 (code `payload_too_large`) and persists nothing; otherwise
 * the size guard admits it for further processing.
 *
 * The guard runs first in the pipeline and `rawBodyByteLength` prefers the
 * `Content-Length` header, so this property drives random `Content-Length`
 * values around the 65536-byte boundary. The Supabase admin client is mocked so
 * the test runs without a real database: token lookup resolves to a fixed
 * player, the demons allow-list check returns every requested level as known,
 * and the `upsert_record` RPC is a spy used to confirm whether the request was
 * admitted (proceeded to persistence) or rejected before any write.
 *
 * **Validates: Requirements 10.4**
 */

// Mock the server-only Supabase client BEFORE importing the handler. The
// specifier matches the one used inside `records.ts` so both resolve to the
// same module in the mock registry.
vi.mock('../_lib/supabaseAdmin.ts', () => {
  // `upsert_record` RPC spy — call count tells us whether a write was attempted.
  const rpc = vi.fn(async () => ({
    data: [{ stored_percentage: 50, applied: true, inserted: true }],
    error: null,
  }));

  // Chainable query-builder stub covering exactly the calls the handler makes:
  //   - dtt_players: .select().eq().maybeSingle()  → fixed player row
  //   - dtt_demons:  .select().in()  (awaited)      → every requested id known
  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    let inValues: string[] = [];
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.in = (_column: string, values: string[]) => {
      inValues = values;
      return builder;
    };
    builder.maybeSingle = async () => ({ data: { id: 'player-fixed-1' }, error: null });
    // Make the builder awaitable for the dtt_demons allow-list check: every
    // requested level_id is reported as known.
    builder.then = (
      resolve: (value: { data: Array<{ level_id: string }>; error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve({
        data: inValues.map((level_id) => ({ level_id })),
        error: null,
      }).then(resolve, reject);
    return builder;
  });

  return { supabaseAdmin: { from, rpc } };
});

// Import AFTER the mock is registered.
import handler from './records.ts';
import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';

/** Maximum raw body size enforced by the guard: 64 KB. */
const MAX_BODY_BYTES = 64 * 1024; // 65536

/** Minimal stand-in for the Vercel response object the handler writes to. */
interface FakeResponse {
  statusCode: number;
  body: { code?: string; status?: string } | undefined;
  headers: Record<string, string>;
  status(code: number): FakeResponse;
  json(body: unknown): FakeResponse;
  setHeader(name: string, value: string): void;
  end(): FakeResponse;
}

function makeRes(): FakeResponse {
  const res = {
    statusCode: 0,
    body: undefined,
    headers: {},
  } as FakeResponse;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body as FakeResponse['body'];
    return res;
  };
  res.setHeader = (name: string, value: string) => {
    res.headers[name] = value;
  };
  res.end = () => res;
  return res;
}

const rpcSpy = supabaseAdmin.rpc as unknown as ReturnType<typeof vi.fn>;

describe('Feature: demon-tier-tracker, Property 7: Payload size guard', () => {
  beforeEach(() => {
    rpcSpy.mockClear();
  });

  it('rejects bodies > 64KB with 413 (persisting nothing) and admits the rest', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Bias generation toward the 65536-byte boundary while still covering a
        // wide range on both sides.
        fc.oneof(
          fc.integer({ min: 65530, max: 65542 }),
          fc.integer({ min: 0, max: 200_000 }),
        ),
        async (contentLength) => {
          const callsBefore = rpcSpy.mock.calls.length;

          const req = {
            method: 'POST',
            headers: {
              // The guard prefers Content-Length; this drives the property.
              'content-length': String(contentLength),
              'x-player-token': 'valid-token-123',
            },
            // A small, valid payload so an admitted request reaches the upsert.
            body: { level_id: 'lvl-1', level_name: 'Test Level', percentage: 50 },
          };
          const res = makeRes();

          await handler(req as never, res as never);

          const callsAfter = rpcSpy.mock.calls.length;

          if (contentLength > MAX_BODY_BYTES) {
            // Over the limit → 413, payload_too_large, and no write attempted.
            expect(res.statusCode).toBe(413);
            expect(res.body?.code).toBe('payload_too_large');
            expect(callsAfter).toBe(callsBefore);
          } else {
            // At or under the limit → not rejected for size; admitted onward.
            expect(res.statusCode).not.toBe(413);
            expect(callsAfter).toBeGreaterThan(callsBefore);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('admits exactly 65536 bytes and rejects 65537 bytes (boundary)', async () => {
    // Exactly at the limit is admitted (reaches the upsert).
    const resAtLimit = makeRes();
    rpcSpy.mockClear();
    await handler(
      {
        method: 'POST',
        headers: {
          'content-length': String(MAX_BODY_BYTES),
          'x-player-token': 'valid-token-123',
        },
        body: { level_id: 'lvl-1', level_name: 'Test Level', percentage: 50 },
      } as never,
      resAtLimit as never,
    );
    expect(resAtLimit.statusCode).not.toBe(413);
    expect(rpcSpy.mock.calls.length).toBeGreaterThan(0);

    // One byte over the limit is rejected with no write.
    const resOver = makeRes();
    rpcSpy.mockClear();
    await handler(
      {
        method: 'POST',
        headers: {
          'content-length': String(MAX_BODY_BYTES + 1),
          'x-player-token': 'valid-token-123',
        },
        body: { level_id: 'lvl-1', level_name: 'Test Level', percentage: 50 },
      } as never,
      resOver as never,
    );
    expect(resOver.statusCode).toBe(413);
    expect(resOver.body?.code).toBe('payload_too_large');
    expect(rpcSpy.mock.calls.length).toBe(0);
  });
});
