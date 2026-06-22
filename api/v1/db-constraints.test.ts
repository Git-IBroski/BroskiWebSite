import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

/**
 * Task 2.7 — Integration test for Database constraints.
 *
 * Exercises the real Postgres constraints on the tracker tables using the
 * service-role client (the same credentials `api/_lib/supabaseAdmin.ts` uses).
 * Unlike the unit tests, this talks to the live Supabase project, so it is
 * guarded to SKIP gracefully when the server-only credentials are absent.
 *
 * Asserts (Testing Strategy → Integration Tests → "DB constraint enforcement"):
 *   - UNIQUE (player_id, level_id) on dtt_records      → 23505 unique_violation
 *   - FK violation on unknown player_id (dtt_records)  → 23503 foreign_key_violation
 *   - FK violation on unknown level_id  (dtt_records)  → 23503 foreign_key_violation
 *   - invalid difficulty_tier on dtt_demons            → 22P02 invalid enum input
 *
 * _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 7.5_
 *
 * Test isolation: every fixture uses a fresh randomUUID()-derived identifier so
 * concurrent constraint/property tasks (2.5, 2.6) never collide, and all created
 * rows are removed in teardown.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HAS_CREDS = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

// A unique per-run namespace so fixtures never clash with other tasks/runs.
const RUN = randomUUID().slice(0, 8);

/** Pull the Postgres SQLSTATE code off a supabase-js / PostgrestError. */
function pgCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

describe.skipIf(!HAS_CREDS)('Database constraints (integration) — Req 8.1-8.6, 7.5', () => {
  let db: SupabaseClient;

  // Fixtures created in setup and cleaned up in teardown.
  const playerUsername = `dtt-test-2_7-${RUN}`;
  const playerTokenHash = `tokenhash-2_7-${RUN}`;
  const demonLevelId = `dtt-test-level-${RUN}`;
  let playerId: string;

  beforeAll(async () => {
    db = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Seed one valid player.
    const { data: player, error: playerErr } = await db
      .from('dtt_players')
      .insert({ username: playerUsername, token_hash: playerTokenHash })
      .select('id')
      .single();
    if (playerErr) throw new Error(`fixture player insert failed: ${playerErr.message}`);
    playerId = (player as { id: string }).id;

    // Seed one valid demon (valid enum value from the difficulty_tier set).
    const { error: demonErr } = await db
      .from('dtt_demons')
      .insert({ level_id: demonLevelId, name: `Test Demon ${RUN}`, difficulty_tier: 'extreme' });
    if (demonErr) throw new Error(`fixture demon insert failed: ${demonErr.message}`);
  });

  afterAll(async () => {
    if (!db) return;
    // Remove rows in FK-safe order: records → player, demon.
    await db.from('dtt_records').delete().eq('player_id', playerId);
    await db.from('dtt_demons').delete().eq('level_id', demonLevelId);
    await db.from('dtt_players').delete().eq('username', playerUsername);
  });

  it('rejects a duplicate (player_id, level_id) with unique_violation 23505 (Req 7.5, 8.5)', async () => {
    // First insert succeeds.
    const first = await db
      .from('dtt_records')
      .insert({ player_id: playerId, level_id: demonLevelId, percentage: 50 });
    expect(first.error).toBeNull();

    // Second insert with the same (player_id, level_id) must violate the unique index.
    const second = await db
      .from('dtt_records')
      .insert({ player_id: playerId, level_id: demonLevelId, percentage: 75 });

    expect(second.error).not.toBeNull();
    expect(pgCode(second.error)).toBe('23505');
  });

  it('rejects a record with an unknown player_id (FK violation 23503) (Req 8.6)', async () => {
    const unknownPlayerId = randomUUID(); // valid uuid shape, no matching row
    const { error } = await db
      .from('dtt_records')
      .insert({ player_id: unknownPlayerId, level_id: demonLevelId, percentage: 10 });

    expect(error).not.toBeNull();
    expect(pgCode(error)).toBe('23503');
  });

  it('rejects a record with an unknown level_id (FK violation 23503) (Req 8.6)', async () => {
    const unknownLevelId = `dtt-missing-level-${RUN}`; // not present in dtt_demons
    const { error } = await db
      .from('dtt_records')
      .insert({ player_id: playerId, level_id: unknownLevelId, percentage: 10 });

    expect(error).not.toBeNull();
    expect(pgCode(error)).toBe('23503');
  });

  it('rejects an invalid difficulty_tier on dtt_demons (invalid enum input 22P02) (Req 8.2)', async () => {
    const { error } = await db.from('dtt_demons').insert({
      level_id: `dtt-bad-tier-${RUN}`,
      name: `Bad Tier Demon ${RUN}`,
      difficulty_tier: 'not_a_real_tier',
    });

    expect(error).not.toBeNull();
    expect(pgCode(error)).toBe('22P02');
  });
});
