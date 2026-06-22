#pragma once

/**
 * Tracker_Mod — Live_Tracking hooks and enqueue wiring (task 10.3, declarations).
 *
 * This header declares the seam between task 10.3 (this file + `live_tracking.cpp`,
 * which hook the completion / percent-update events, run the higher-only gating,
 * and enqueue a Record) and task 10.4 (the async `web::WebRequest` networking with
 * timeout / retry / dequeue-on-confirmation).
 *
 * OWNERSHIP / COORDINATION:
 *   - Task 10.3 OWNS `live_tracking.{hpp,cpp}`: the `PlayLayer::levelComplete` and
 *     `PlayLayer::destroyPlayer` `$modify` hooks, the in-memory last-reported map
 *     (gating.h), and the persisted RetryQueue (retry_queue.h). Registering these
 *     hooks needs no central wiring — Geode's `$modify` macro self-registers from
 *     whatever translation unit defines it, so `live_tracking.cpp` coexists with
 *     the `MenuLayer` hook task 8.5 owns in `main.cpp`.
 *   - Task 10.4 OWNS `submitRecordAsync`: it is DECLARED here but intentionally NOT
 *     DEFINED by task 10.3, so 10.4 can implement the real background POST (10s
 *     success-confirmation → queue on timeout, 30s hard cancel, ≤3 retries,
 *     dequeue on confirmation) in its own networking .cpp without conflicting.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 3.1.
 */

#include "tracker/retry_queue.h"

namespace tracker {

/**
 * Asynchronously submits a single Record to the Records_API (Req 2.2, 2.3, 3.1).
 *
 * DECLARED by task 10.3, DEFINED by task 10.4. The Live_Tracking hooks call this
 * after a qualifying higher-only event; the implementation MUST dispatch the work
 * to a background thread (Geode `web::WebRequest`) so the calling hook stalls the
 * main thread for ≤1 ms (Req 3.1). On a confirmed success the implementation calls
 * `confirmLiveSubmission(record.level_id)` to remove the Record from the retry
 * queue (Req 2.7); on timeout/failure it leaves the persisted entry in place so it
 * is retried later (Req 2.6).
 *
 * NOTE: not defined in this task. Until task 10.4 lands, the Geode mod target will
 * not link — this is expected and isolated to the (GD-dependent) mod build, which
 * cannot be compiled in this environment regardless.
 */
void submitRecordAsync(const Record& record);

/**
 * Removes a confirmed Record from the persisted retry queue (Req 2.7).
 *
 * DEFINED by task 10.3 in `live_tracking.cpp`; CALLED by task 10.4's networking
 * code from its success-confirmation callback. Safe to call for a level_id that is
 * not queued (no-op). This is the single entry point that both the synchronous
 * hook path and the asynchronous confirmation path use to mutate the queue, so the
 * one-entry-per-level invariant and the on-change persistence stay centralized.
 */
void confirmLiveSubmission(const std::string& levelId);

}  // namespace tracker
