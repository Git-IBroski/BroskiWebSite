#pragma once

/**
 * Shared per-session Initial_Sync flag (Tracker_Mod).
 *
 * This tiny header is the single source of truth for the "Initial_Sync has
 * completed for the current session" boolean, shared between:
 *   - task 8.5 (the `MenuLayer::init` hook in `main.cpp`), which SETS the flag
 *     only on a 200 within 30s and leaves it unset on failure (Req 1.6, 1.8), and
 *   - task 10.3 (the Live_Tracking hooks in `live_tracking.cpp`), which READS the
 *     flag to withhold all live submissions while it is unset (Req 2.5).
 *
 * COORDINATION NOTE (task 8.5):
 *   `main.cpp` currently owns the `MenuLayer::init` hook. When task 8.5 wires up
 *   the Initial_Sync POST, it should `#include "session_state.hpp"` and call
 *   `tracker::setInitialSyncDone(true)` on success instead of defining its own
 *   flag, so both phases observe the same value. If 8.5 already exposes an
 *   `isInitialSyncDone()` accessor, collapse the two onto whichever lands first;
 *   this header is intentionally header-only with no .cpp so it can be adopted
 *   without a link-time conflict.
 *
 * Design intent: the flag is per-session (process-lifetime) and is intentionally
 * NOT persisted — every launch starts with Initial_Sync unset so it is retried
 * (Req 1.8). It is stored in an atomic because it is written from the main thread
 * (or the Initial_Sync completion callback) and read from the Live_Tracking hooks;
 * the atomic makes that cross-thread read/write well-defined and lock-free.
 *
 * This header depends ONLY on the C++ standard library (no Geode SDK), so it can
 * be included from any translation unit, including pure-logic tests.
 */

#include <atomic>

namespace tracker {

/**
 * The process-wide Initial_Sync flag, defined via a function-local static inside
 * an inline function so there is exactly ONE instance across all translation
 * units that include this header (no ODR violation, no separate .cpp needed).
 */
inline std::atomic<bool>& initialSyncDoneFlag() {
    static std::atomic<bool> flag{false};
    return flag;
}

/**
 * Returns true once Initial_Sync has completed successfully for this session.
 * Live_Tracking submissions are withheld while this is false (Req 2.5).
 */
inline bool isInitialSyncDone() {
    return initialSyncDoneFlag().load(std::memory_order_acquire);
}

/**
 * Sets the Initial_Sync flag for the current session. Task 8.5 calls this with
 * `true` only after the Initial_Sync POST returns a success within its 30s
 * window (Req 1.6); it is left `false` (the default) on failure so the sync is
 * retried on the next launch (Req 1.8).
 */
inline void setInitialSyncDone(bool done) {
    initialSyncDoneFlag().store(done, std::memory_order_release);
}

}  // namespace tracker
