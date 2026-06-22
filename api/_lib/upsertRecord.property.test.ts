import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Property 1: Monotonic, idempotent, confluent upsert
 *
 * Feature: demon-tier-tracker, Property 1: Monotonic, idempotent, confluent upsert —
 * for any player, level_id, and any (possibly empty, possibly duplicated)
 * multiset of submitted percentages in any processing order (including parallel
 * calls), after all submissions the database holds exactly one record for that
 * (player, level_id), and its stored percentage equals the maximum submitted
 * percentage; submitting an equal-or-lower percentage leaves the stored value
 * unchanged.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.5, 7.6, 6.6
 *
 * ---------------------------------------------------------------------------
 * ENVIRONMENT
 * ---------------------------------------------------------------------------
 * This is an integration-style property test. It exercises the REAL
 * `upsert_record` SECURITY DEFINER RPC against the hosted Supabase project so
 * the atomic `ON CONFLICT ... WHERE excluded.percentage > records.percentage`
 * semantics are genuinely tested (the design mandates running API-side
 * properties against the real RPC).
 *
 * The RPC's EXECUTE privilege is granted only to `service_role`, so the test
 * must use the service-role client. That requires the server-only env vars
 * `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to be present at runtime.
 *
 * When those credentials are NOT available (e.g. local dev without secrets),
 * the whole suite SKIPS gracefully instead of failing — the test is still
 * written, type-checked, and ready to run wherever the credentials exist
 * (CI / Vercel with the secrets configured).
 *
 * `api/_lib/supabaseAdmin.ts` throws at import time when the env vars are
 * missing, so it is imported DYNAMICALLY inside `beforeAll`, only after the
 * credential check passes.
 */

const HAS_CREDENTIALS = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// numeric(5,2) stores two decimal places. Generate percentages on that exact
// grid so "stored == max submitted" is an exact comparison rather than a
// rounding battle. Values range over [0.00, 100.00].
const percentageArb: fc.Arbitrary<number> = fc
  .integer({ min: 0, max: 10000 })
  .map((cents) => cents / 100);

describe.skipIf(!HAS_CREDENTIALS)(
  'Property 1: Monotonic, idempotent, confluent upsert',
  () => {
    let supabaseAdmin: SupabaseClient;

    // Unique throwaway identities for this run so concurrent test tasks never
    // collide on the shared hosted DB.
    const runToken = randomUUID();
    const testPlayerUsername = `dtt-pbt-player-${runToken}`;
    const testLevelId = `dtt-pbt-level-${runToken}`;
    let testPlayerId: string;

    beforeAll(async () => {
      // Dynamic import: this module throws if env vars are missing, which is
      // why it is loaded here rather than at the top of the file.
      ({ supabaseAdmin } = await import('./supabaseAdmin'));

      // Create a dedicated test demon (satisfies the records.level_id FK).
      const { error: demonError } = await supabaseAdmin.from('dtt_demons').insert({
        level_id: testLevelId,
        name: `PBT Test Demon ${runToken}`,
        difficulty_tier: 'extreme',
      });
      if (demonError) {
        throw new Error(`Failed to seed test demon: ${demonError.message}`);
      }

      // Create a dedicated test player. token_hash is UNIQUE + NOT NULL; we
      // never authenticate with it here (we call the RPC with player_id
      // directly), so a random hash is sufficient.
      const tokenHash = createHash('sha256').update(runToken).digest('hex');
      const { data: playerRow, error: playerError } = await supabaseAdmin
        .from('dtt_players')
        .insert({ username: testPlayerUsername, token_hash: tokenHash })
        .select('id')
        .single();
      if (playerError || !playerRow) {
        throw new Error(
          `Failed to seed test player: ${playerError?.message ?? 'no row returned'}`,
        );
      }
      testPlayerId = playerRow.id as string;
    });

    afterAll(async () => {
      if (!supabaseAdmin) return;
      // Teardown in FK-safe order: records → player → demon. Leave the shared
      // DB exactly as we found it.
      await supabaseAdmin.from('dtt_records').delete().eq('player_id', testPlayerId);
      await supabaseAdmin.from('dtt_players').delete().eq('id', testPlayerId);
      await supabaseAdmin.from('dtt_demons').delete().eq('level_id', testLevelId);
    });

    // Remove any record for (testPlayer, testLevel) so each property iteration
    // starts from a clean slate.
    async function clearRecord(): Promise<void> {
      const { error } = await supabaseAdmin
        .from('dtt_records')
        .delete()
        .eq('player_id', testPlayerId)
        .eq('level_id', testLevelId);
      if (error) throw new Error(`clearRecord failed: ${error.message}`);
    }

    // Submit one percentage through the real RPC.
    async function submit(percentage: number): Promise<void> {
      const { error } = await supabaseAdmin.rpc('upsert_record', {
        p_player_id: testPlayerId,
        p_level_id: testLevelId,
        p_percentage: percentage,
      });
      if (error) throw new Error(`upsert_record failed: ${error.message}`);
    }

    // Read back every record row for (testPlayer, testLevel).
    async function readRows(): Promise<Array<{ percentage: number }>> {
      const { data, error } = await supabaseAdmin
        .from('dtt_records')
        .select('percentage')
        .eq('player_id', testPlayerId)
        .eq('level_id', testLevelId);
      if (error) throw new Error(`readRows failed: ${error.message}`);
      return (data ?? []).map((r) => ({ percentage: Number(r.percentage) }));
    }

    it(
      'stores exactly one row holding the MAX of any multiset submitted in any order (incl. parallel & duplicates)',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            // A (possibly empty) multiset of percentages — duplicates allowed.
            fc.array(percentageArb, { minLength: 0, maxLength: 8 }),
            // How many of the submissions are fired in parallel (the rest run
            // sequentially first). Drives the confluence/concurrency aspect.
            fc.nat(),
            async (percentages, parallelSplitSeed) => {
              await clearRecord();

              if (percentages.length === 0) {
                // Empty multiset: no submissions ⇒ no record should exist.
                const rows = await readRows();
                expect(rows.length).toBe(0);
                return;
              }

              // Partition into a sequential prefix and a parallel suffix so we
              // exercise both ordered and concurrent processing paths.
              const splitAt = parallelSplitSeed % (percentages.length + 1);
              const sequential = percentages.slice(0, splitAt);
              const parallel = percentages.slice(splitAt);

              for (const pct of sequential) {
                await submit(pct);
              }
              await Promise.all(parallel.map((pct) => submit(pct)));

              const rows = await readRows();
              const expectedMax = Math.max(...percentages);

              // Exactly one record (UNIQUE (player_id, level_id) + idempotency).
              expect(rows.length).toBe(1);
              // Stored value equals the maximum submitted (higher-only,
              // confluent under any order / parallelism / duplicates).
              expect(rows[0].percentage).toBeCloseTo(expectedMax, 2);
            },
          ),
          // Each iteration performs several network round-trips; cap runs at the
          // mandated minimum to keep the integration test tractable.
          { numRuns: 100 },
        );
      },
      // Generous timeout: 100 iterations × several RPC round-trips to a hosted DB.
      600_000,
    );

    it('treats an equal-or-lower resubmission as a no-op (stored value unchanged)', async () => {
      await fc.assert(
        fc.asyncProperty(
          percentageArb,
          percentageArb,
          async (first, second) => {
            await clearRecord();

            // Establish the higher of the two as the stored baseline first.
            const high = Math.max(first, second);
            const low = Math.min(first, second);
            await submit(high);

            // Resubmitting an equal-or-lower value must not change the stored value.
            await submit(low);

            const rows = await readRows();
            expect(rows.length).toBe(1);
            expect(rows[0].percentage).toBeCloseTo(high, 2);
          },
        ),
        { numRuns: 100 },
      );
    }, 600_000);
  },
);
