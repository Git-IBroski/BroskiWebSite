# Implementation Plan: Demon Tier Tracker

## Overview

This plan converts the design into incremental coding steps following the design's milestone
roadmap: **M1 Database → M2 Records_API → (Tier List Site, built once data exists) → M3 Mod
Phase 1 / Initial Sync → M4 Mod Phase 2 / Live Tracking**. Each task builds on the previous and
ends by wiring components together so there is no orphaned code.

Implementation languages are fixed by the design:
- **TypeScript** for the Records_API (Vercel serverless) and the React 19 + Vite tier list site.
- **C++ (Geode SDK)** for the Tracker_Mod (a separate project in the repo).

Property-based tests use **fast-check + vitest** (TypeScript) and **rapidcheck** (C++ pure logic),
minimum **100 iterations**, tagged `Feature: demon-tier-tracker, Property {n}: {property_text}`.
All 16 design properties are implemented as property-based tests; example, integration, and
performance tests from the Testing Strategy are also included.

## Tasks

- [x] 1. Set up test tooling and shared types
  - [x] 1.1 Add and configure `vitest` and `fast-check` dev dependencies
    - Add `test` and `test:run` scripts to `package.json` (`vitest --run` for single execution)
    - Create `vitest.config.ts`; set fast-check global config to a minimum of 100 runs
    - _Testing Strategy: Property-Based Tests (library + 100 iterations)_
  - [x] 1.2 Define shared TypeScript types for records and API responses
    - Create `src/features/demon-tier-tracker/types.ts` with `RecordInput` (`level_id`, `level_name`, `percentage`), validation result, and the success/error response envelope shapes
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

- [x] 2. Database schema, upsert RPC, RLS, and seed (Supabase migrations via MCP)
  - [x] 2.1 Create the core schema migration
    - Create `difficulty_tier` enum; `players` (unique `username`, unique `token_hash`, nullable `profile_id`, UTC `created_at`); `demons` (`level_id` PK, `name`, `difficulty_tier`, `created_at`); `records` (`player_id` FK, `level_id` FK, `percentage numeric(5,2)` CHECK 0..100, `updated_at`) with the `UNIQUE (player_id, level_id)` index
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 7.5_
  - [x] 2.2 Create the `upsert_record` SECURITY DEFINER RPC
    - Single-statement `INSERT ... ON CONFLICT (player_id, level_id) DO UPDATE ... WHERE excluded.percentage > records.percentage`; set `updated_at = now()`; return stored percentage and `applied`/`inserted`
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 8.4_
  - [x] 2.3 Enable RLS, anon read-only policies, and `tier_list_view`
    - Enable RLS on `players`, `demons`, `records`; add anon `SELECT`-only policies; create `tier_list_view` exposing `username` + percentages + tier (never `token_hash`); add no anon write policies
    - _Requirements: 10.5, 9.1, 9.3, 9.5_
  - [x] 2.4 Seed the demons allow-list and apply all migrations
    - Insert the known demon levels (`level_id`, `name`, `difficulty_tier`) and apply the migrations through Supabase MCP
    - _Requirements: 8.2, 10.3_
  - [x]* 2.5 Property test for the upsert
    - **Property 1: Monotonic, idempotent, confluent upsert** — drive randomized permutations and duplicate multisets (including parallel calls) against the real `upsert_record` RPC; assert a single row holding the max percentage; equal-or-lower is a no-op
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5, 7.6, 6.6**
  - [x]* 2.6 Property test for the public read path
    - **Property 8: Public read path is write-incapable** — for arbitrary insert/update/delete attempts via the anon client, assert denial and unchanged data
    - **Validates: Requirements 10.5**
  - [x]* 2.7 Integration test for DB constraints
    - Assert unique `(player_id, level_id)`, FK violations on unknown player/level, and invalid `difficulty_tier` are rejected
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 7.5_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Records_API serverless function (`POST /api/v1/records`)
  - [x] 4.1 Add the server-side Supabase service client and token hashing utility
    - Create `api/_lib/supabaseAdmin.ts` using `SUPABASE_SERVICE_ROLE_KEY` (server-only); create `api/_lib/token.ts` with SHA-256 hashing for token lookup; update `.env.example`
    - _Requirements: 5.3, 5.8, 10.1_
  - [x] 4.2 Implement payload normalization and validation
    - Create `api/_lib/validate.ts`: normalize single object → `[one]`; enforce array count 1..1000; validate non-empty `level_id` and numeric `percentage` in 0..100; all-or-nothing with offending field/index
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.4_
  - [x] 4.3 Implement the request pipeline in `api/v1/records.ts`
    - Wire: 64KB size guard (413) → extract `X-Player-Token` (empty/>512 → missing) → hash + lookup player within 2s (401 no match / 503 timeout) → normalize + validate (400) → per-record `upsert_record` RPC (FK miss → 400 `unknown_level`; DB error → 500) → 200 envelope with per-record `applied`/`reason`/`stored_percentage`; attribute by token only, ignore body `player_id`
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 5.8, 6.6, 7.7, 10.1, 10.3, 10.4_
  - [x] 4.4 Carve `/api` out of the SPA rewrite in `vercel.json`
    - Change the rewrite source to `/((?!api/|\\.well-known/).*)` so serverless routes are not swallowed by the SPA fallback
    - _Requirements: 6.1, 6.2_
  - [x]* 4.5 Property test for payload normalization
    - **Property 2: Payload normalization equivalence** — single `r` and `[r]` yield identical stored results; arrays process in received order
    - **Validates: Requirements 6.1, 6.2**
  - [x]* 4.6 Property test for validation
    - **Property 3: All-or-nothing validation** — any missing field / non-numeric / out-of-range percentage rejects the whole request with 400, names the field, persists nothing
    - **Validates: Requirements 6.3, 6.4, 7.4**
  - [x]* 4.7 Property test for authentication
    - **Property 4: Authentication rejection persists nothing** — missing/empty/>512/non-matching token returns 401 and persists nothing regardless of payload
    - **Validates: Requirements 5.2, 5.4, 5.5, 5.7, 10.2**
  - [x]* 4.8 Property test for attribution
    - **Property 5: Attribution invariance** — any payload `player_id` (forged/other/none) is ignored; records attributed to the token's player
    - **Validates: Requirements 10.1**
  - [x]* 4.9 Property test for level allow-listing
    - **Property 6: Level allow-listing** — any record with a `level_id` not in `demons` rejects the request with 400, persists nothing
    - **Validates: Requirements 10.3**
  - [x]* 4.10 Property test for the size guard
    - **Property 7: Payload size guard** — bodies > 64KB return 413 and persist nothing; otherwise admitted
    - **Validates: Requirements 10.4**
  - [x]* 4.11 Example unit tests for the API
    - Header token extraction (5.1), valid-token proceed-to-processing (5.8), `updated_at` advances on an applied upsert (8.4)
    - _Requirements: 5.1, 5.8, 8.4_
  - [x]* 4.12 Integration tests for the endpoint
    - End-to-end POST against a Supabase test project covering 200, 401, 400, 413, and 503 paths
    - _Requirements: 5.3, 5.6, 7.7_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Tier List Site page (React, anon read-only)
  - [x] 6.1 Implement the read-only data access hook
    - Create `src/features/demon-tier-tracker/useTierList.ts` reading `tier_list_view` via the existing anon `supabase` client; reflect committed state at load time
    - _Requirements: 9.8, 10.5_
  - [x] 6.2 Implement grouping and ordering pure logic
    - Create `src/features/demon-tier-tracker/ordering.ts`: group demons by tier highest→lowest; order records percentage desc, ties by player name asc; expose integer percentage
    - _Requirements: 9.1, 9.3, 9.5_
  - [x] 6.3 Build the tier list page and wire the route
    - Create the page component (demon groups, per-demon records, 100% badge, empty states for no demons / no records, indicator-fallback omission) and register the route in the app router
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  - [x]* 6.4 Property test for record ordering
    - **Property 14: Tier list ordering** — records ordered percentage desc, ties alphabetical asc by player; each shows player + integer percentage 0..100
    - **Validates: Requirements 9.3, 9.5**
  - [x]* 6.5 Property test for group ordering
    - **Property 15: Difficulty group ordering** — tier groups render highest difficulty to lowest
    - **Validates: Requirements 9.1**
  - [x]* 6.6 Property test for the 100% indicator
    - **Property 16: Hundred-percent indicator** — indicator present iff percentage equals 100
    - **Validates: Requirements 9.6**
  - [x]* 6.7 Example unit tests for site branches
    - No-demons empty state (9.2), per-demon no-records state (9.4), indicator-fallback omission (9.7)
    - _Requirements: 9.2, 9.4, 9.7_
  - [x]* 6.8 Integration test for freshness
    - Change records, reload, assert updated data renders
    - _Requirements: 9.8_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Tracker_Mod Phase 1 — scaffold and Initial Sync (Geode / C++)
  - [x] 8.1 Scaffold the Geode mod project
    - Create the mod project (`mod.json`, `CMakeLists.txt`, entry source) and a `rapidcheck` test target configured for ≥100 iterations
    - _Requirements: 1.1, 3.1_
  - [x] 8.2 Implement the token settings field
    - Geode settings field for a 1..256 char token; persist across launches; reject empty/whitespace saves and retain the prior value with a notice
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 8.3 Implement local completion read and filtering
    - Read per-level `levelID`, name, and best normal-mode percent from `GameStatsManager`/`GameLevelManager`; pure filter that drops entries missing `level_id`/name/percentage or with percentage outside 0..100 and counts skips
    - _Requirements: 1.2, 1.3_
  - [x] 8.4 Implement serialization and batching
    - Serialize valid completions to a JSON array (empty array when none); chunk into batches of ≤1000 records and ≤64KB
    - _Requirements: 1.4, 6.2, 10.4_
  - [x] 8.5 Implement the `MenuLayer::init` hook and sync POST
    - On first invocation per session, if a token is set and the sync flag is unset, dispatch a background read + POST with `X-Player-Token`, wait up to 30s; set `initial_sync_done` only on a 200 within 30s; leave unset on failure; skip and record when no token
    - _Requirements: 1.1, 1.5, 1.6, 1.7, 1.8, 3.1, 4.4, 4.5_
  - [x]* 8.6 Property test for completion filtering
    - **Property 9: Local completion filtering** — upload set equals exactly the valid completions; skipped count equals the number of invalid ones (rapidcheck)
    - **Validates: Requirements 1.3**
  - [x]* 8.7 Property test for serialization round-trip
    - **Property 10: Completion serialization round-trip** — serialize then parse yields an equivalent list, including the empty list (rapidcheck)
    - **Validates: Requirements 1.4**
  - [x]* 8.8 Property test for token rejection
    - **Property 13: Whitespace token rejection** — any empty/whitespace-only string is rejected on save and the prior token is retained (rapidcheck)
    - **Validates: Requirements 4.3**
  - [x]* 8.9 Example unit tests for Phase 1
    - Struct→Record mapping (1.2), sync-flag transitions (1.6–1.8), token presence wiring incl. abort-when-missing (4.4, 4.5)
    - _Requirements: 1.2, 1.6, 1.7, 1.8, 4.4, 4.5_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Tracker_Mod Phase 2 — Live Tracking and retry queue
  - [x] 10.1 Implement higher-only gating logic
    - Pure function over a last-reported map ("none" treated as lower than any value); emit iff new percentage is strictly greater
    - _Requirements: 2.2, 2.3, 2.4_
  - [x] 10.2 Implement the persisted retry queue
    - In-memory `level_id → Record` map capped at one entry per level holding the highest percentage; persist as JSON in the mod save dir on change; remove on confirmation
    - _Requirements: 2.6, 2.7, 2.8_
  - [x] 10.3 Hook completion/percent-update events and enqueue
    - Hook `PlayLayer::levelComplete` (100%) and the percent-update path (new-best partials); O(1) compare + enqueue, then trigger an async POST; withhold while the sync flag is unset
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1_
  - [x] 10.4 Implement async networking with timeout and retry
    - Use `web::WebRequest` on a background thread: 10s success-confirmation → queue on timeout; hard cancel at 30s; up to 3 connection retries; log and continue on failure without modifying gameplay state; dequeue on confirmation
    - _Requirements: 2.6, 2.7, 3.2, 3.3, 3.4, 3.5_
  - [x]* 10.5 Property test for live gating
    - **Property 11: Higher-only live gating** — emits iff new percentage strictly greater than last-reported (none < any) (rapidcheck)
    - **Validates: Requirements 2.2, 2.3, 2.4**
  - [x]* 10.6 Property test for the retry queue
    - **Property 12: Retry queue keeps one highest entry per level** — at most one entry per level at the max enqueued percentage since last confirmation; confirmed levels absent (rapidcheck)
    - **Validates: Requirements 2.7, 2.8**
  - [x]* 10.7 Integration test for mod networking
    - Against a stub server: 30s cancel, retry-3-on-no-connection, 10s queue-on-timeout
    - _Requirements: 2.6, 3.3, 3.4, 3.5_
  - [x]* 10.8 Performance test for the main-thread budget
    - Instrument hook bodies; assert per-frame overhead < 1ms while a request is in flight and request initiation stalls the main thread < 1ms
    - _Requirements: 3.1, 3.2_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP.
- Each task references the specific requirements and/or design properties it implements.
- Property tests use fast-check + vitest (TypeScript) and rapidcheck (C++), min 100 iterations,
  tagged `Feature: demon-tier-tracker, Property {n}: {property_text}`.
- The tier list site (task 6) is built once the database and API exist, per the design roadmap.
- The Tracker_Mod (tasks 8, 10) is a separate C++/Geode project within the repo.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "8.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "4.1", "8.2", "8.3", "10.1"] },
    { "id": 2, "tasks": ["2.4", "4.2", "8.4", "10.2"] },
    { "id": 3, "tasks": ["4.3", "6.2", "8.5", "10.3"] },
    { "id": 4, "tasks": ["4.4", "6.1", "10.4", "2.5", "2.6", "2.7", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "6.4", "6.5", "8.6", "8.7", "8.8", "8.9", "10.5", "10.6"] },
    { "id": 5, "tasks": ["6.3", "4.12", "10.7", "10.8"] },
    { "id": 6, "tasks": ["6.6", "6.7", "6.8"] }
  ]
}
```
