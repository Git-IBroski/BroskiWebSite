#pragma once

/**
 * Tracker_Mod — Live_Tracking async networking (task 10.4, declarations).
 *
 * This file OWNS the GD-dependent asynchronous submission of a single
 * Live_Tracking Record. It is the home of the DEFINITION of
 * `tracker::submitRecordAsync` (DECLARED by task 10.3 in `live_tracking.hpp`,
 * intentionally left undefined there so this task can supply the real background
 * `web::WebRequest` implementation). The implementation lives in `networking.cpp`
 * and includes the Geode SDK (`web::WebRequest`, `EventListener<web::WebTask>`,
 * `timeout`), so it can only be compiled on a machine with `GEODE_SDK` configured
 * and is excluded from the pure-logic test build (-DTRACKER_BUILD_TESTS=ON).
 *
 * The pure decision/payload logic this layer drives — `serializeLiveRecord` and
 * the `RetryPolicy` state machine — lives in <tracker/live_submission.h> and is
 * unit-testable without Geode.
 *
 * COORDINATION:
 *   - `submitRecordAsync` is declared in `live_tracking.hpp` (task 10.3) and is
 *     NOT redeclared here, to avoid a duplicate declaration; `networking.cpp`
 *     includes `live_tracking.hpp` so its definition matches that seam and can
 *     call `confirmLiveSubmission` on a confirmed POST (Req 2.7).
 *   - The Records_API endpoint (`kRecordsApiUrl`), the `X-Player-Token` header
 *     name (`kPlayerTokenHeader`), and the success-status helper are reused from
 *     task 8.5's `initial_sync.hpp` / <tracker/initial_sync.h>, so live and bulk
 *     submissions share one endpoint and one auth-header convention (Req 4.4).
 *
 * Requirements: 2.6, 2.7, 3.2, 3.3, 3.4, 3.5.
 */

#include "tracker/live_submission.h"

namespace tracker {

/**
 * Resubmits every Record currently persisted in the retry queue (Req 2.6).
 *
 * Intended to flush Records that were queued in a previous session because their
 * Live_Tracking POST was never confirmed (Req 2.6). Reads the persisted queue from
 * the Geode mod save dir, then hands each Record to `submitRecordAsync`; a
 * confirmed submission dequeues it via `confirmLiveSubmission` (Req 2.7), and an
 * unconfirmed one is simply left in the queue for the next attempt.
 *
 * Safe to call when the queue is empty (no-op) and when no token is configured
 * (it returns early; `submitRecordAsync` would otherwise abort per Req 4.5).
 *
 * RECOMMENDED WIRING (intentionally NOT done here so this task does not edit files
 * owned by other tasks — main.cpp/8.5, initial_sync.cpp/8.5): call
 * `tracker::retryPersistedQueue()` once Live_Tracking is permitted, i.e. on the
 * Initial_Sync success path right after `setInitialSyncDone(true)`, and/or from the
 * `MenuLayer::init` hook on launch. Include this header there and add the call.
 */
void retryPersistedQueue();

}  // namespace tracker
