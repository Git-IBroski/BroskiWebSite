/**
 * Property 8: Public read path is write-incapable.
 *
 * Feature: demon-tier-tracker, Property 8: Public read path is write-incapable
 *
 * *For any* insert, update, or delete attempted through the site's anon read
 * path, the operation is denied and the stored data is unchanged.
 *
 * Validates: Requirements 10.5
 *
 * Strategy: construct a fresh Supabase client using ONLY the anon key
 * (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY). The anon role has SELECT-only
 * RLS policies and NO insert/update/delete policies on dtt_players,
 * dtt_demons, dtt_records. We drive randomized write attempts (insert/update/
 * delete) with random, non-existent identifiers against all three tables and
 * assert each attempt is "denied": either an error is returned, or zero rows
 * are affected (PostgREST returns no rows when RLS hides every candidate row).
 * A snapshot of each table is captured before and after the randomized write
 * attempts to assert the stored data is unchanged.
 *
 * The test uses the anon key exclusively — never the service-role key — because
 * the service role bypasses RLS and would defeat the purpose of the property.
 * Write attempts use random non-existent ids so nothing real is targeted; under
 * correct RLS nothing is mutated regardless.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Resolve anon credentials from Vite's import.meta.env (loaded from .env by
// vitest's Vite pipeline). `process` is intentionally not referenced so this
// file type-checks under the browser (tsconfig.app) project.
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

const hasAnonCreds = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Tables that must reject all anon writes (Req 10.5). */
const TABLES = ['dtt_records', 'dtt_demons', 'dtt_players'] as const;
type TableName = (typeof TABLES)[number];

/** A randomized write attempt produced by the generator. */
interface WriteAttempt {
  table: TableName;
  op: 'insert' | 'update' | 'delete';
  /** Insert payload (random, non-existent identifiers). */
  insertRow: Record<string, unknown>;
  /** Column used to target update/delete (with a non-existent value). */
  filterColumn: string;
  filterValue: string;
  /** Patch applied on update. */
  updatePatch: Record<string, unknown>;
}

/**
 * Attempt a single write and report whether it was denied.
 * Denied == an error was returned OR no rows were affected (empty result),
 * which is exactly what SELECT-only RLS produces for the anon role.
 */
async function attemptWriteDenied(
  client: SupabaseClient,
  attempt: WriteAttempt,
): Promise<boolean> {
  if (attempt.op === 'insert') {
    const { data, error } = await client
      .from(attempt.table)
      .insert(attempt.insertRow)
      .select();
    return error !== null || data == null || data.length === 0;
  }
  if (attempt.op === 'update') {
    const { data, error } = await client
      .from(attempt.table)
      .update(attempt.updatePatch)
      .eq(attempt.filterColumn, attempt.filterValue)
      .select();
    return error !== null || data == null || data.length === 0;
  }
  // delete
  const { data, error } = await client
    .from(attempt.table)
    .delete()
    .eq(attempt.filterColumn, attempt.filterValue)
    .select();
  return error !== null || data == null || data.length === 0;
}

/**
 * Snapshot a table's anon-visible rows for an unchanged-data comparison.
 * If SELECT itself is denied, return a stable marker so before/after still
 * compare equal (the row set is "unchanged" either way).
 */
async function snapshot(client: SupabaseClient, table: TableName): Promise<string> {
  const { data, error } = await client.from(table).select('*');
  if (error) return `error:${error.code ?? error.message}`;
  const rows = (data ?? []) as Record<string, unknown>[];
  // Deterministic ordering for comparison.
  const normalized = rows
    .map((r) => JSON.stringify(r, Object.keys(r).sort()))
    .sort();
  return `rows:${normalized.length}:${JSON.stringify(normalized)}`;
}

/** fast-check arbitrary producing a randomized, non-existent write attempt. */
function writeAttemptArb(): fc.Arbitrary<WriteAttempt> {
  const nonExistentString = fc
    .string({ minLength: 1, maxLength: 24 })
    .map((s) => `pbt-nonexistent-${s}`);
  const percentage = fc.double({ min: 0, max: 100, noNaN: true });

  const insertRowForTable: Record<TableName, fc.Arbitrary<Record<string, unknown>>> = {
    dtt_records: fc.record({
      id: fc.uuid(),
      player_id: fc.uuid(),
      level_id: nonExistentString,
      percentage,
    }),
    dtt_demons: fc.record({
      level_id: nonExistentString,
      name: nonExistentString,
      difficulty_tier: fc.constantFrom('extreme', 'insane', 'hard'),
    }),
    dtt_players: fc.record({
      id: fc.uuid(),
      username: nonExistentString,
      token_hash: nonExistentString,
    }),
  };

  const filterColumnForTable: Record<TableName, string> = {
    dtt_records: 'level_id',
    dtt_demons: 'level_id',
    dtt_players: 'username',
  };

  return fc
    .record({
      table: fc.constantFrom(...TABLES),
      op: fc.constantFrom('insert' as const, 'update' as const, 'delete' as const),
      filterValue: nonExistentString,
      updatePatch: fc.record({ percentage }),
    })
    .chain((base) =>
      insertRowForTable[base.table].map((insertRow) => ({
        table: base.table,
        op: base.op,
        insertRow,
        filterColumn: filterColumnForTable[base.table],
        filterValue: base.filterValue,
        updatePatch: base.updatePatch,
      })),
    );
}

describe.skipIf(!hasAnonCreds)(
  'Feature: demon-tier-tracker, Property 8: Public read path is write-incapable',
  () => {
    let client: SupabaseClient;

    beforeAll(() => {
      // Anon key ONLY — never the service-role key (would bypass RLS).
      client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    });

    it(
      'denies arbitrary anon insert/update/delete attempts and leaves data unchanged',
      async () => {
        // Capture baseline snapshots of all tables before any write attempts.
        const before = Object.fromEntries(
          await Promise.all(
            TABLES.map(async (t) => [t, await snapshot(client, t)] as const),
          ),
        );

        await fc.assert(
          fc.asyncProperty(writeAttemptArb(), async (attempt) => {
            const denied = await attemptWriteDenied(client, attempt);
            return denied;
          }),
          { numRuns: 100 },
        );

        // After all randomized writes, the anon-visible data must be unchanged.
        for (const t of TABLES) {
          const after = await snapshot(client, t);
          expect(after).toBe(before[t]);
        }
      },
      120_000,
    );
  },
);
