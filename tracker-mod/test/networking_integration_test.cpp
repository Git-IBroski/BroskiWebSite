/**
 * Integration test for the Tracker_Mod Live_Tracking networking decision logic
 * (task 10.7, optional).
 *
 * =====================================================================================
 * WHAT THIS FILE RUNS (decision-logic simulation, no Geode SDK required)
 * =====================================================================================
 * The real transport (src/networking.cpp) drives Geode's `web::WebRequest` on a
 * background thread and feeds each attempt's result into the pure
 * <tracker/live_submission.h> RetryPolicy state machine, which decides whether to
 * Dequeue (confirmed), Retry (no connection), or GiveUp (rejected / timed out /
 * 30 s ceiling). That GD-/libcurl-backed path CANNOT be compiled or run in this
 * environment (it needs the Geode SDK and a live GD client).
 *
 * So this file runs the SAME decision pipeline networking.cpp runs, but against a
 * small in-test STUB transport that yields a scripted sequence of attempt results
 * (HTTP statuses, connection-refused, or cancellations) and a scripted clock. The
 * driver below mirrors LiveSubmission::attempt()/onEvent()/handleOutcome() exactly:
 *
 *   1. before each attempt, stop if the 30 s hard-cancel ceiling has elapsed (Req 3.3),
 *   2. record the attempt, ask the stub for the next result, classify it the way
 *      onEvent() does (200 -> Confirmed, status<=0 -> NoConnection, other ->
 *      RejectedResponse, cancellation -> TimedOut),
 *   3. run RetryPolicy::decide() and act: Dequeue removes the Record from the
 *      persisted RetryQueue (Req 2.7); Retry loops; GiveUp leaves it queued (Req 2.6).
 *
 * This meaningfully validates the retry/timeout/cancel DECISION logic that drives
 * networking.cpp end-to-end (Req 2.6, 3.3, 3.4, 3.5) using the production types,
 * without mocking those types.
 *
 * Asserted scenarios:
 *   A. 3x NoConnection -> Retry,Retry,Retry, 4th -> GiveUp (retry-3-on-no-connection,
 *      Req 3.5); the Record stays queued throughout.
 *   B. TimedOut (10 s confirmation window lapsed) -> GiveUp, Record stays queued
 *      (10 s queue-on-timeout, Req 2.6).
 *   C. NoConnection with a clock advancing ~10 s/attempt -> the 30 s ceiling stops
 *      further attempts before the retry cap is even reached (30 s cancel, Req 3.3);
 *      the Record stays queued.
 *   D. Confirmed (HTTP 200) -> Dequeue; the Record is removed from the queue (Req 2.7).
 *   E. RejectedResponse (HTTP 500) -> GiveUp; the Record stays queued (Req 3.4).
 *
 * =====================================================================================
 * TRUE STUB-HTTP-SERVER INTEGRATION TEST (documented only — run on a Geode machine)
 * =====================================================================================
 * The end-to-end transport test below is documented but NOT compiled here, because
 * web::WebRequest requires the Geode SDK + a GD client. To run it on a
 * Geode-configured machine:
 *
 *   Setup: stand up a localhost stub HTTP server (e.g. a tiny Python/Node script)
 *   and point the mod's Records_API URL (src/initial_sync.hpp kRecordsApiUrl) at it,
 *   e.g. http://127.0.0.1:8787/api/v1/records. Configure a valid Secret Player Token
 *   so submitRecordAsync() does not abort (Req 4.4/4.5). Enqueue one Record, then
 *   call submitRecordAsync() and observe the persisted retry queue + logs.
 *
 *   Scenario 1 — 10 s queue-on-timeout (Req 2.6):
 *     Stub DELAYS its response past 10 s (e.g. sleep 12 s before replying 200).
 *     Expect: the 10 s confirmation window lapses, the attempt is cancelled
 *     (TimedOut -> GiveUp), and the Record REMAINS in the persisted queue so it is
 *     retried on the next qualifying event/launch. It must NOT be dequeued.
 *
 *   Scenario 2 — retry-3-on-no-connection (Req 3.5):
 *     Stub REFUSES connections (port closed / RST). Expect: web::WebRequest reports
 *     a transport error (status <= 0 -> NoConnection), the policy retries up to 3
 *     times (4 total attempts), then gives up; the Record stays queued and gameplay
 *     is unaffected (Req 3.4 logging only).
 *
 *   Scenario 3 — 30 s hard cancel (Req 3.3):
 *     Stub DELAYS past 30 s (or keep refusing so repeated ~10 s waits accumulate).
 *     Expect: the submission is hard-cancelled once cumulative elapsed >= 30 s,
 *     a timeout is logged, the Record stays queued, and no gameplay state changes.
 *
 *   Scenario 4 — non-success response (Req 3.4):
 *     Stub returns a non-200 (e.g. 400/401/500). Expect: RejectedResponse -> GiveUp,
 *     logged, Record stays queued (no retry on a real HTTP error), gameplay untouched.
 *
 *   Scenario 5 — confirmation/dequeue (Req 2.7, supporting):
 *     Stub returns 200 within 10 s. Expect: Confirmed -> the Record is removed from
 *     the persisted retry queue.
 *
 *   Each scenario asserts on (a) the persisted retry-queue JSON in the mod save dir
 *   before/after and (b) the absence of any gameplay-state mutation (the hook bodies
 *   only do O(1) enqueue work; Req 3.1/3.2). This file's simulation already covers
 *   the DECISION outcomes for every scenario above using the same production types.
 */
#include "tracker/live_submission.h"
#include "tracker/retry_queue.h"

#include <cstdio>
#include <string>
#include <vector>

namespace {

using tracker::Record;
using tracker::RetryDecision;
using tracker::RetryPolicy;
using tracker::RetryQueue;
using tracker::SubmissionOutcome;

bool expect(bool cond, const char* what) {
    if (!cond) {
        std::printf("[networking_integration] FAIL: %s\n", what);
    }
    return cond;
}

// --- In-test stub transport ---------------------------------------------------
//
// Models what the GD/libcurl transport would surface for one network attempt: it
// either delivers an HTTP response (a status code), or it is cancelled because the
// 10 s confirmation window lapsed. Each attempt advances a scripted monotonic clock
// so the 30 s hard-cancel ceiling (Req 3.3) can be exercised deterministically.

enum class StubEventKind {
    Response,   // an HTTP response actually arrived (carries httpStatus)
    Cancelled,  // the 10 s window lapsed / task cancelled -> TimedOut
};

struct StubAttempt {
    StubEventKind kind;
    int httpStatus;        // meaningful only when kind == Response; <=0 == no connection
    double attemptSeconds; // wall time this attempt consumes before its result arrives
};

// A scripted stub "server": returns a predetermined result per attempt and tracks
// the cumulative elapsed time the driver has spent so far.
class StubServer {
public:
    explicit StubServer(std::vector<StubAttempt> script) : script_(std::move(script)) {}

    double elapsedSeconds() const { return elapsed_; }

    // Returns the next scripted attempt result, advancing the clock by its duration.
    StubAttempt nextAttempt() {
        const StubAttempt a = script_.at(index_++);
        elapsed_ += a.attemptSeconds;
        return a;
    }

private:
    std::vector<StubAttempt> script_;
    std::size_t index_ = 0;
    double elapsed_ = 0.0;
};

// The result of driving one Record through the stub transport + RetryPolicy.
struct DriveResult {
    RetryDecision finalDecision = RetryDecision::GiveUp;
    int attempts = 0;
    bool dequeued = false;          // Record removed from the queue (confirmed)
    bool stoppedByDeadline = false; // the 30 s ceiling cut retries short
    std::vector<RetryDecision> decisions;  // decision per attempt, in order
};

// Mirrors LiveSubmission's attempt/onEvent/handleOutcome loop from networking.cpp,
// but pumped by the stub transport instead of web::WebRequest. This is the seam
// that lets the production decision logic run end-to-end without the Geode SDK.
DriveResult drive(RetryQueue& queue, const Record& record, StubServer& server,
                  RetryPolicy& policy) {
    DriveResult result;
    while (true) {
        // Req 3.3: enforce the 30 s hard-cancel ceiling before issuing an attempt.
        if (RetryPolicy::hardDeadlineElapsed(server.elapsedSeconds())) {
            result.stoppedByDeadline = true;
            result.finalDecision = RetryDecision::GiveUp;
            break;
        }

        policy.recordAttempt();
        result.attempts = policy.attempts();

        const StubAttempt attempt = server.nextAttempt();

        // Classify exactly as LiveSubmission::onEvent does.
        SubmissionOutcome outcome;
        if (attempt.kind == StubEventKind::Response) {
            if (attempt.httpStatus == 200) {
                outcome = SubmissionOutcome::Confirmed;       // Req 2.7
            } else if (attempt.httpStatus <= 0) {
                outcome = SubmissionOutcome::NoConnection;    // Req 3.5
            } else {
                outcome = SubmissionOutcome::RejectedResponse;// Req 3.4
            }
        } else {
            outcome = SubmissionOutcome::TimedOut;            // Req 2.6, 3.3
        }

        const RetryDecision decision = policy.decide(outcome);
        result.decisions.push_back(decision);
        result.finalDecision = decision;

        if (decision == RetryDecision::Dequeue) {
            queue.confirm(record.level_id);  // Req 2.7
            result.dequeued = true;
            break;
        }
        if (decision == RetryDecision::GiveUp) {
            break;  // Req 2.6 / 3.4: leave the Record queued
        }
        // RetryDecision::Retry -> loop and issue the next attempt (Req 3.5).
    }
    return result;
}

Record makeRecord() { return Record{"44622744", "Tartarus", 73}; }

// Scenario A: retry-3-on-no-connection (Req 3.5). Each attempt fails to connect
// (status <= 0) and consumes only 1 s so the 30 s ceiling is never the cause.
bool testRetryThreeOnNoConnection() {
    bool ok = true;
    RetryQueue queue;
    const Record rec = makeRecord();
    queue.enqueue(rec);

    StubServer server({
        {StubEventKind::Response, -1, 1.0},
        {StubEventKind::Response, -1, 1.0},
        {StubEventKind::Response, -1, 1.0},
        {StubEventKind::Response, -1, 1.0},
    });
    RetryPolicy policy;
    const DriveResult r = drive(queue, rec, server, policy);

    ok &= expect(r.decisions.size() == 4, "no-connection: 4 attempts total (3 retries)");
    if (r.decisions.size() == 4) {
        ok &= expect(r.decisions[0] == RetryDecision::Retry, "1st no-connection -> Retry");
        ok &= expect(r.decisions[1] == RetryDecision::Retry, "2nd no-connection -> Retry");
        ok &= expect(r.decisions[2] == RetryDecision::Retry, "3rd no-connection -> Retry");
        ok &= expect(r.decisions[3] == RetryDecision::GiveUp, "4th no-connection -> GiveUp (Req 3.5)");
    }
    ok &= expect(!r.stoppedByDeadline, "retries exhausted by the cap, not the 30s ceiling");
    ok &= expect(!r.dequeued && queue.contains(rec.level_id),
                 "no-connection: Record stays queued (Req 2.6)");
    return ok;
}

// Scenario B: 10 s queue-on-timeout (Req 2.6). The 10 s confirmation window lapses
// without a response (TimedOut) -> GiveUp, Record remains queued.
bool testTimeoutLeavesQueued() {
    bool ok = true;
    RetryQueue queue;
    const Record rec = makeRecord();
    queue.enqueue(rec);

    // One attempt that consumes the full 10 s confirmation window, then cancels.
    StubServer server({
        {StubEventKind::Cancelled, 0, static_cast<double>(tracker::kLiveConfirmationTimeoutSeconds)},
    });
    RetryPolicy policy;
    const DriveResult r = drive(queue, rec, server, policy);

    ok &= expect(r.attempts == 1, "timeout: a single attempt is made");
    ok &= expect(r.finalDecision == RetryDecision::GiveUp,
                 "timeout/cancel -> GiveUp (Req 2.6)");
    ok &= expect(!r.dequeued && queue.contains(rec.level_id),
                 "timeout: Record stays queued for later retry (Req 2.6)");
    return ok;
}

// Scenario C: 30 s hard cancel (Req 3.3). Connection failures each consume ~10 s,
// so the 30 s ceiling stops further attempts BEFORE the 3-retry cap is reached.
bool testHardDeadlineStopsRetries() {
    bool ok = true;
    RetryQueue queue;
    const Record rec = makeRecord();
    queue.enqueue(rec);

    // 3 no-connection attempts at 10 s each -> elapsed hits 30 s, blocking a 4th.
    StubServer server({
        {StubEventKind::Response, -1, 10.0},
        {StubEventKind::Response, -1, 10.0},
        {StubEventKind::Response, -1, 10.0},
        {StubEventKind::Response, -1, 10.0},  // should never be consumed
    });
    RetryPolicy policy;
    const DriveResult r = drive(queue, rec, server, policy);

    ok &= expect(r.attempts == 3, "30s ceiling: only 3 attempts fit before 30s");
    ok &= expect(r.stoppedByDeadline, "30s hard-cancel ceiling stops further attempts (Req 3.3)");
    ok &= expect(!r.dequeued && queue.contains(rec.level_id),
                 "30s cancel: Record stays queued (Req 2.6, 3.3)");
    return ok;
}

// Scenario D: confirmation dequeues (Req 2.7). HTTP 200 within the window.
bool testConfirmedDequeues() {
    bool ok = true;
    RetryQueue queue;
    const Record rec = makeRecord();
    queue.enqueue(rec);

    StubServer server({
        {StubEventKind::Response, 200, 1.0},
    });
    RetryPolicy policy;
    const DriveResult r = drive(queue, rec, server, policy);

    ok &= expect(r.finalDecision == RetryDecision::Dequeue, "HTTP 200 -> Dequeue (Req 2.7)");
    ok &= expect(r.dequeued && !queue.contains(rec.level_id),
                 "confirmed: Record removed from the queue (Req 2.7)");
    return ok;
}

// Scenario E: non-success response gives up (Req 3.4). A real HTTP error is not
// retried; the Record is left queued and gameplay continues.
bool testRejectedResponseGivesUp() {
    bool ok = true;
    RetryQueue queue;
    const Record rec = makeRecord();
    queue.enqueue(rec);

    StubServer server({
        {StubEventKind::Response, 500, 1.0},
    });
    RetryPolicy policy;
    const DriveResult r = drive(queue, rec, server, policy);

    ok &= expect(r.attempts == 1, "rejected: not retried, single attempt (Req 3.4)");
    ok &= expect(r.finalDecision == RetryDecision::GiveUp, "HTTP 500 -> GiveUp (Req 3.4)");
    ok &= expect(!r.dequeued && queue.contains(rec.level_id),
                 "rejected: Record stays queued (Req 3.4)");
    return ok;
}

// Direct check of the 30 s ceiling predicate boundary (Req 3.3).
bool testHardDeadlineBoundary() {
    bool ok = true;
    ok &= expect(!RetryPolicy::hardDeadlineElapsed(29.999), "<30s does not stop attempts");
    ok &= expect(RetryPolicy::hardDeadlineElapsed(30.0), ">=30s stops attempts (Req 3.3)");
    ok &= expect(RetryPolicy::hardDeadlineElapsed(31.0), ">30s stops attempts (Req 3.3)");
    return ok;
}

}  // namespace

// Declared in smoke_test.cpp's main(); runs the networking integration simulation.
bool run_networking_integration_tests() {
    bool ok = true;
    ok &= testRetryThreeOnNoConnection();
    ok &= testTimeoutLeavesQueued();
    ok &= testHardDeadlineStopsRetries();
    ok &= testConfirmedDequeues();
    ok &= testRejectedResponseGivesUp();
    ok &= testHardDeadlineBoundary();
    if (ok) {
        std::printf("[networking_integration] integration simulation passed\n");
    }
    return ok;
}
