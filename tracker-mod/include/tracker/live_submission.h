#pragma once

/**
 * Pure, Geode-independent logic supporting the Tracker_Mod's Live_Tracking
 * asynchronous submission (task 10.4).
 *
 * This header OWNS the two pure pieces the GD-dependent networking layer
 * (src/networking.cpp) builds on, kept here so they compile and are unit-/
 * property-testable WITHOUT the Geode SDK or Geometry Dash headers (the
 * -DTRACKER_BUILD_TESTS=ON path):
 *
 *   1. serializeLiveRecord() — the Phase 2 "Live Single Update" JSON body, a
 *      single object `{"level_id","level_name","percentage"}` (design: API
 *      Payload Specification). Reuses the same string escaping as the persisted
 *      retry queue so level names round-trip verbatim.
 *   2. RetryPolicy — the connection-retry state machine and outcome
 *      classification that decide, after each network attempt, whether to dequeue
 *      (confirmed), retry (no connection), or give up (non-success / timeout).
 *
 * Depends only on the C++ standard library and the pure `Record` type from
 * retry_queue.h. The GD-dependent driver (web::WebRequest, EventListener,
 * timeouts) lives in src/networking.cpp and feeds outcomes into this logic.
 *
 * OWNERSHIP: created by task 10.4. It does NOT modify any existing header; it is
 * a new sibling of the other pure headers under include/tracker/.
 *
 * Requirements:
 *   2.6  - leave the Record queued when no HTTP 200 success-confirmation arrives
 *          within the 10 s window (the policy returns GiveUp on TimedOut).
 *   2.7  - dequeue on a confirmed (HTTP 200) submission (Dequeue).
 *   3.2  - provide the serialized single-object body POSTed off the main thread.
 *   3.3  - enforce a 30 s hard-cancel ceiling across attempts (hardDeadlineElapsed).
 *   3.4  - give up (log + continue, gameplay untouched) on a non-success response.
 *   3.5  - retry up to 3 times when no connection can be established.
 */

#include <string>

#include "tracker/retry_queue.h"

namespace tracker {

// Timing / retry policy constants (design: "Networking, Queue, and Persistence").
inline constexpr int kLiveConfirmationTimeoutSeconds = 10;  // Req 2.6
inline constexpr int kLiveHardCancelSeconds = 30;           // Req 3.3
inline constexpr int kMaxConnectionRetries = 3;             // Req 3.5

/**
 * Serializes a single Record to the Phase 2 "Live Single Update" JSON object
 * (design: API Payload Specification):
 *
 *   {"level_id":"<id>","level_name":"<name>","percentage":<int>}
 *
 * Reuses `detail::appendJsonString` (retry_queue.h) so control characters, quotes,
 * backslashes, and multi-byte UTF-8 names are escaped/round-tripped exactly the
 * same way the persisted queue escapes them.
 */
inline std::string serializeLiveRecord(const Record& record) {
    std::string out;
    out += "{\"level_id\":";
    detail::appendJsonString(out, record.level_id);
    out += ",\"level_name\":";
    detail::appendJsonString(out, record.level_name);
    out += ",\"percentage\":";
    out += std::to_string(record.percentage);
    out.push_back('}');
    return out;
}

/// The outcome of a single live-submission network attempt.
enum class SubmissionOutcome {
    /// HTTP 200 received within the window -> dequeue the Record (Req 2.7).
    Confirmed,
    /// A response arrived but was not HTTP 200 -> stop, leave queued (Req 3.4).
    RejectedResponse,
    /// No connection could be established -> retry up to the cap (Req 3.5).
    NoConnection,
    /// Cancelled / no confirmation in time -> leave queued (Req 2.6, 3.3).
    TimedOut,
};

/**
 * Classifies a *received* HTTP status (i.e. a response actually arrived) into a
 * confirmed-or-rejected outcome (Req 2.7, 3.4). Connection failures (no HTTP
 * status at all) are detected by the driver and mapped to NoConnection directly.
 */
inline constexpr SubmissionOutcome classifyResponseStatus(int httpStatus) noexcept {
    return httpStatus == 200 ? SubmissionOutcome::Confirmed
                             : SubmissionOutcome::RejectedResponse;
}

/// What the networking driver should do next after an attempt's outcome.
enum class RetryDecision {
    /// Confirmed: remove the Record from the persisted retry queue (Req 2.7).
    Dequeue,
    /// Issue another attempt (Req 3.5).
    Retry,
    /// Stop; leave the Record queued for a later event/launch (Req 2.6, 3.3, 3.4).
    GiveUp,
};

/**
 * Pure connection-retry state machine (Req 3.5).
 *
 * Counts connection failures and decides, per outcome, whether to dequeue, retry,
 * or give up:
 *   - Confirmed         -> Dequeue (Req 2.7).
 *   - RejectedResponse  -> GiveUp; a real HTTP error is not retried, the Record is
 *                          left queued and gameplay continues (Req 3.4).
 *   - TimedOut          -> GiveUp; the 10 s window lapsed or the 30 s ceiling was
 *                          hit, so the Record stays queued for later (Req 2.6, 3.3).
 *   - NoConnection      -> Retry while the failure count is within the cap
 *                          (default 3), else GiveUp (Req 3.5).
 *
 * Side-effect-free except for its internal counters, so it can be exhaustively
 * unit-tested without the live game.
 */
class RetryPolicy {
public:
    explicit RetryPolicy(int maxConnectionRetries = kMaxConnectionRetries) noexcept
        : maxRetries_(maxConnectionRetries) {}

    int connectionFailures() const noexcept { return connectionFailures_; }
    int attempts() const noexcept { return attempts_; }

    /// Call once just before each network attempt is issued.
    void recordAttempt() noexcept { ++attempts_; }

    /// Decide the next action for an outcome, updating the failure counter for
    /// NoConnection. Confirmed/RejectedResponse/TimedOut are terminal.
    RetryDecision decide(SubmissionOutcome outcome) noexcept {
        switch (outcome) {
            case SubmissionOutcome::Confirmed:
                return RetryDecision::Dequeue;
            case SubmissionOutcome::RejectedResponse:  // Req 3.4
            case SubmissionOutcome::TimedOut:          // Req 2.6, 3.3
                return RetryDecision::GiveUp;
            case SubmissionOutcome::NoConnection:      // Req 3.5
                ++connectionFailures_;
                return connectionFailures_ <= maxRetries_ ? RetryDecision::Retry
                                                          : RetryDecision::GiveUp;
        }
        return RetryDecision::GiveUp;
    }

    /// True once the overall 30 s hard-cancel ceiling has elapsed (Req 3.3). Pure
    /// in `elapsedSeconds` so it can be tested without a real clock.
    static constexpr bool hardDeadlineElapsed(double elapsedSeconds) noexcept {
        return elapsedSeconds >= static_cast<double>(kLiveHardCancelSeconds);
    }

private:
    int maxRetries_;
    int connectionFailures_ = 0;
    int attempts_ = 0;
};

}  // namespace tracker
