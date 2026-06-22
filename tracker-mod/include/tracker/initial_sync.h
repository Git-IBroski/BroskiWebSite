#pragma once

/**
 * Pure, Geode-independent decision + session-flag logic for the Tracker_Mod's
 * Initial_Sync (task 8.5).
 *
 * This header has NO dependency on the Geode SDK or Geometry Dash headers and
 * uses ONLY the C++ standard library, so it builds and is testable under
 * -DTRACKER_BUILD_TESTS=ON on any machine with a C++20 toolchain (the sync-flag
 * transition tests of task 8.9, Req 1.6-1.8, target the helpers declared here).
 *
 * It captures the "should I sync, and what does the result mean for the session
 * flag?" rules so they can be reasoned about without the live game:
 *
 *   - decideSyncAction()  -> what the MenuLayer::init hook should do this launch
 *                            (Req 1.1, 1.7).
 *   - SyncSession         -> the per-session state machine for `initial_sync_done`
 *                            and the recorded outcome (Req 1.6, 1.7, 1.8).
 *   - isSyncSuccessStatus -> classifies an HTTP status as a successful sync
 *                            (Req 1.5, 1.6: a 200 within the 30 s timeout).
 *
 * The GD-dependent half (reading local completions, dispatching the background
 * POST with the X-Player-Token header) lives in `src/initial_sync.*` and can only
 * be compiled with the Geode SDK configured.
 *
 * Requirements:
 *   1.1 - trigger a read of local completions when the post-load menu appears AND
 *         a token is configured AND the session flag is unset.
 *   1.6 - set the session flag only when the sync POST(s) succeed (HTTP 200)
 *         within the timeout.
 *   1.7 - if no token is configured, skip the sync and record it was not
 *         attempted.
 *   1.8 - on a failure/timeout, leave the session flag unset and record a
 *         sync-failure so the sync is retried on the next launch.
 */

namespace tracker {

/**
 * The HTTP status the Records_API returns for a fully processed, valid request
 * (design "Success response (HTTP 200, Req 6.6)"). Initial_Sync treats only this
 * status, received within the 30 s timeout, as success (Req 1.6).
 */
inline constexpr int kSyncSuccessStatus = 200;

/// True iff `httpStatus` denotes a successful sync response (Req 1.5, 1.6).
inline constexpr bool isSyncSuccessStatus(int httpStatus) noexcept {
    return httpStatus == kSyncSuccessStatus;
}

/**
 * What the `MenuLayer::init` hook should do on a given launch, decided from two
 * cheap booleans so the hook body stays O(1) on the main thread (Req 3.1).
 */
enum class SyncAction {
    /// A token is configured and the session flag is unset: read local
    /// completions and POST them (Req 1.1).
    Attempt,
    /// No token is configured: skip the sync and record it was not attempted
    /// (Req 1.7, 4.5).
    SkipNoToken,
    /// Initial_Sync already completed for this session: do nothing.
    AlreadyDone,
};

/**
 * Pure decision for the hook (Req 1.1, 1.7).
 *
 * @param hasToken   whether a valid Secret_Player_Token is currently configured.
 * @param syncDone   whether the session `initial_sync_done` flag is already set.
 *
 * Precedence: an already-completed sync short-circuits regardless of the token so
 * a token edited away mid-session never re-triggers a redundant sync; otherwise a
 * missing token means skip, and a present token means attempt.
 */
inline constexpr SyncAction decideSyncAction(bool hasToken, bool syncDone) noexcept {
    if (syncDone) {
        return SyncAction::AlreadyDone;
    }
    if (!hasToken) {
        return SyncAction::SkipNoToken;
    }
    return SyncAction::Attempt;
}

/**
 * The recorded result of this session's Initial_Sync, for diagnostics/logging and
 * to make the "retry next launch" intent explicit (Req 1.8).
 */
enum class SyncOutcome {
    /// No attempt has been made yet this session.
    NotAttempted,
    /// Skipped because no token was configured (Req 1.7).
    SkippedNoToken,
    /// A read+POST is currently in flight.
    InProgress,
    /// All batches returned HTTP 200 within the timeout; flag is set (Req 1.6).
    Succeeded,
    /// A batch failed or timed out; flag left unset to retry next launch (Req 1.8).
    Failed,
};

/**
 * The per-session Initial_Sync state machine.
 *
 * Holds the `initial_sync_done` flag (Req 1.6) and the last recorded outcome.
 * Transitions are deliberately small and side-effect-free so they can be unit-
 * tested without the game (task 8.9). A single instance is owned by the
 * GD-dependent layer (`src/initial_sync.cpp`) for the lifetime of the process.
 */
class SyncSession {
public:
    /// True once Initial_Sync has succeeded this session (the `initial_sync_done`
    /// flag). Live_Tracking submissions are withheld while this is false (Req 2.5).
    bool isDone() const noexcept { return done_; }

    /// True once an attempt (or a deliberate skip) has occurred this session, so
    /// the hook only ever dispatches once per launch.
    bool wasAttempted() const noexcept { return outcome_ != SyncOutcome::NotAttempted; }

    SyncOutcome outcome() const noexcept { return outcome_; }

    /// Mark that a read+POST has begun (Req 1.1). Does not set the flag.
    void markInProgress() noexcept { outcome_ = SyncOutcome::InProgress; }

    /// Record that the sync was skipped because no token is configured (Req 1.7).
    /// The flag stays unset so a later launch with a token still syncs.
    void markSkippedNoToken() noexcept {
        done_ = false;
        outcome_ = SyncOutcome::SkippedNoToken;
    }

    /// Record a successful sync: set the session flag (Req 1.6).
    void markSucceeded() noexcept {
        done_ = true;
        outcome_ = SyncOutcome::Succeeded;
    }

    /// Record a failed/timed-out sync: leave the flag unset so Initial_Sync is
    /// retried on the next launch (Req 1.8).
    void markFailed() noexcept {
        done_ = false;
        outcome_ = SyncOutcome::Failed;
    }

private:
    bool done_ = false;
    SyncOutcome outcome_ = SyncOutcome::NotAttempted;
};

}  // namespace tracker
