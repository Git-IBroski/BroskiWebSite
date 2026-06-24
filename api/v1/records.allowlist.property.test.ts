import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { RecordInput } from '../../src/features/demon-tier-tracker/types';

/**
 * Feature: demon-tier-tracker, Property 6: Level allow-listing
 *
 * For any request containing records whose `level_id` is not present in the
 * `dtt_demons` table, the Records_API SKIPS those records (persisting nothing for
 * them) while still storing the records whose level IS in the allow-list, and
 * returns HTTP 200.
 *
 * Validates: Requirements 10.3
 *
 * Runs entirely against mocks — no real database. `../_lib/supabaseAdmin` is
 * replaced with a fake whose behaviour is driven per-iteration via the hoisted
 * `state` object:
 *   (a) the `dtt_players` token lookup always resolves to a fixed authenticated
 *       player so the request reaches payload/level processing;
 *   (b) the `dtt_demons` `select('level_id').in(...)` returns only the chosen
 *       KNOWN subset of level_ids;
 *   (c) every `rpc('upsert_record')` call is captured so we can assert that an
 *       allow-list rejection persists nothing.
 */

const h = vi.hoisted(() => ({
  state: {
    /** The level_ids that "exist" in dtt_demons for the current iteration. */
    knownLevelIds: new Set<string>(),
    /** Every captured upsert_record RPC invocation (proves persistence). */
    upsertCalls: [] as Array<{ fn: string; args: unknown }>,
    /** The fixed authenticated player id the token resolves to. */
    playerId: 'fixed-player-00000000-0000-0000-0000-000000000000',
  },
}));

vi.mock('../_lib/supabaseAdmin.ts', () => {
  const supabaseAdmin = {
    from(table: string) {
      if (table === 'dtt_players') {
        // (a) token lookup → fixed authenticated player.
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          async maybeSingle() {
            return { data: { id: h.state.playerId }, error: null };
          },
        };
        return builder;
      }

      if (table === 'dtt_demons') {
        // (b) level allow-list lookup → only the KNOWN subset is returned.
        const builder = {
          select() {
            return builder;
          },
          async in(_column: string, ids: string[]) {
            const rows = ids
              .filter((id) => h.state.knownLevelIds.has(id))
              .map((id) => ({ level_id: id }));
            return { data: rows, error: null };
          },
        };
        return builder;
      }

      throw new Error(`unexpected table in mock: ${table}`);
    },

    // (c) capture upsert_record calls; report a benign applied success.
    async rpc(fn: string, args: unknown) {
      h.state.upsertCalls.push({ fn, args });
      return { data: [{ stored_percentage: 100, applied: true, inserted: true }], error: null };
    },
  };

  return { supabaseAdmin };
});

// Import AFTER the mock is registered so the handler binds to the fake client.
import handler from './records';

/* -------------------------------------------------------------------------- */
/* Minimal request/response doubles                                           */
/* -------------------------------------------------------------------------- */

interface CapturedRes {
  statusCode?: number;
  body?: { code?: string; field?: string; status?: string } & Record<string, unknown>;
  headers: Record<string, string>;
  status(code: number): CapturedRes;
  json(b: unknown): CapturedRes;
  setHeader(name: string, value: string): void;
  end(): CapturedRes;
}

function makeRes(): CapturedRes {
  const res: CapturedRes = {
    statusCode: undefined,
    body: undefined,
    headers: {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(b: unknown) {
      res.body = b as CapturedRes['body'];
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
    end() {
      return res;
    },
  };
  return res;
}

function makeReq(body: unknown) {
  return {
    method: 'POST',
    headers: { 'x-player-token': 'valid-secret-token' },
    body,
  };
}

/** Reset per-iteration mock state and load the known allow-list. */
function resetState(knownIds: string[]): void {
  h.state.knownLevelIds = new Set(knownIds);
  h.state.upsertCalls = [];
}

/* -------------------------------------------------------------------------- */
/* Arbitraries                                                                */
/* -------------------------------------------------------------------------- */

const pctArb = fc.double({ min: 0, max: 100, noNaN: true });
const nameArb = fc.string({ minLength: 1, maxLength: 40 });

// Disjoint id spaces guarantee a generated "unknown" id can never accidentally
// equal a "known" id.
const knownIdArb = fc.string({ minLength: 1, maxLength: 6 }).map((s) => `known-${s}`);
const unknownIdArb = fc.string({ minLength: 1, maxLength: 6 }).map((s) => `unknown-${s}`);

function recordArb(levelIdArb: fc.Arbitrary<string>): fc.Arbitrary<RecordInput> {
  return fc.record({
    level_id: levelIdArb,
    level_name: nameArb,
    percentage: pctArb,
  });
}

/**
 * A request that contains at least one record with a level_id NOT in the demons
 * allow-list (plus any number of known-level records), and the known allow-list
 * the demons table will report.
 */
const unknownCaseArb = fc
  .tuple(
    fc.uniqueArray(knownIdArb, { maxLength: 5 }),
    fc.array(recordArb(unknownIdArb), { minLength: 1, maxLength: 5 }),
  )
  .chain(([knownIds, unknownRecords]) => {
    const knownRecordsArb =
      knownIds.length > 0
        ? fc.array(recordArb(fc.constantFrom(...knownIds)), { maxLength: 5 })
        : fc.constant([] as RecordInput[]);
    return knownRecordsArb.map((knownRecords) => ({
      knownIds,
      // interleave so the unknown record is not always last
      records: [...knownRecords, ...unknownRecords] as RecordInput[],
    }));
  });

/** A request whose every record references a known (allow-listed) level. */
const allKnownCaseArb = fc
  .uniqueArray(knownIdArb, { minLength: 1, maxLength: 5 })
  .chain((knownIds) =>
    fc
      .array(recordArb(fc.constantFrom(...knownIds)), { minLength: 1, maxLength: 5 })
      .map((records) => ({ knownIds, records })),
  );

/* -------------------------------------------------------------------------- */
/* Property                                                                   */
/* -------------------------------------------------------------------------- */

describe('Property 6: Level allow-listing', () => {
  it('skips records with unknown levels (200) and persists only the known ones', async () => {
    await fc.assert(
      fc.asyncProperty(unknownCaseArb, async ({ knownIds, records }) => {
        resetState(knownIds);

        const res = makeRes();
        await handler(makeReq(records) as never, res as never);

        // Unknown levels are skipped, not rejected: the request still succeeds.
        expect(res.statusCode).toBe(200);
        expect(res.body?.code).not.toBe('unknown_level');

        // Only the records whose level_id is in the allow-list are persisted.
        const knownSet = new Set(knownIds);
        const expectedStored = records.filter((r) => knownSet.has(r.level_id));
        expect(h.state.upsertCalls).toHaveLength(expectedStored.length);
      }),
    );
  });

  it('persists every record when they all reference a known level', async () => {
    await fc.assert(
      fc.asyncProperty(allKnownCaseArb, async ({ knownIds, records }) => {
        resetState(knownIds);

        const res = makeRes();
        await handler(makeReq(records) as never, res as never);

        // No allow-list rejection: succeeds and persists each record.
        expect(res.statusCode).toBe(200);
        expect(res.body?.code).not.toBe('unknown_level');
        expect(h.state.upsertCalls).toHaveLength(records.length);
      }),
    );
  });
});
