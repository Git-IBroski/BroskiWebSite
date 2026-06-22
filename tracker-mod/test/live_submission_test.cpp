/**
 * Example/unit coverage for the pure Live_Tracking submission logic (task 10.4).
 *
 * Verifies <tracker/live_submission.h> compiles standalone under the
 * -DTRACKER_BUILD_TESTS=ON path (no Geode SDK) and that its decision/payload logic
 * holds on representative cases:
 *   - the single-Record live payload serializes to the Phase 2 object shape and
 *     round-trips through the persisted-queue parser (Req 3.2),
 *   - HTTP 200 confirms (dequeue) and other statuses reject (Req 2.7, 3.4),
 *   - "no connection" retries up to 3 times then gives up (Req 3.5),
 *   - a timeout/cancel gives up, leaving the Record queued (Req 2.6, 3.3),
 *   - the 30 s hard-cancel ceiling triggers at/after 30 s (Req 3.3).
 *
 * The GD-dependent networking driver itself (web::WebRequest, EventListener) is
 * exercised by the optional integration test (task 10.7) against a stub server.
 */
#include "tracker/live_submission.h"
#include "tracker/retry_queue.h"

#include <cstdio>
#include <string>
#include <vector>

namespace {

using tracker::classifyResponseStatus;
using tracker::Record;
using tracker::RetryDecision;
using tracker::RetryPolicy;
using tracker::RetryQueue;
using tracker::serializeLiveRecord;
using tracker::SubmissionOutcome;

bool expect(bool cond, const char* what) {
    if (!cond) {
        std::printf("[live_submission] FAIL: %s\n", what);
    }
    return cond;
}

bool testSerializeShapeAndRoundTrip() {
    bool ok = true;

    // Exact Phase 2 single-object shape (design: API Payload Specification).
    const Record simple{"44622744", "Tartarus", 73};
    ok &= expect(
        serializeLiveRecord(simple) ==
            "{\"level_id\":\"44622744\",\"level_name\":\"Tartarus\",\"percentage\":73}",
        "single record serializes to the live single-update object");

    // Tricky characters must escape and round-trip through the queue parser, which
    // accepts exactly `[{level_id,level_name,percentage}]`.
    const Record tricky{"128", "Theory of \"Everything\" 2\n\t", 100};
    const std::string asArray = "[" + serializeLiveRecord(tricky) + "]";
    const auto parsed = RetryQueue::fromJson(asArray);
    ok &= expect(parsed.has_value(), "serialized live record parses as a 1-element array");
    if (parsed.has_value()) {
        const std::vector<Record> recs = parsed->records();
        ok &= expect(recs.size() == 1 && recs[0] == tricky,
                     "live record round-trips (escaping preserved)");
    }
    return ok;
}

bool testStatusClassification() {
    bool ok = true;
    ok &= expect(classifyResponseStatus(200) == SubmissionOutcome::Confirmed,
                 "HTTP 200 classifies as Confirmed");
    ok &= expect(classifyResponseStatus(401) == SubmissionOutcome::RejectedResponse,
                 "HTTP 401 classifies as RejectedResponse");
    ok &= expect(classifyResponseStatus(500) == SubmissionOutcome::RejectedResponse,
                 "HTTP 500 classifies as RejectedResponse");
    return ok;
}

bool testConfirmedDequeues() {
    RetryPolicy policy;
    return expect(policy.decide(SubmissionOutcome::Confirmed) == RetryDecision::Dequeue,
                  "confirmed outcome dequeues (Req 2.7)");
}

bool testRejectedAndTimeoutGiveUp() {
    bool ok = true;
    RetryPolicy a;
    ok &= expect(a.decide(SubmissionOutcome::RejectedResponse) == RetryDecision::GiveUp,
                 "non-success response gives up, leaving record queued (Req 3.4)");
    RetryPolicy b;
    ok &= expect(b.decide(SubmissionOutcome::TimedOut) == RetryDecision::GiveUp,
                 "timeout/cancel gives up, leaving record queued (Req 2.6, 3.3)");
    return ok;
}

bool testNoConnectionRetriesUpToThree() {
    RetryPolicy policy;  // default cap of 3 connection retries (Req 3.5)
    bool ok = true;
    ok &= expect(policy.decide(SubmissionOutcome::NoConnection) == RetryDecision::Retry,
                 "1st no-connection -> retry");
    ok &= expect(policy.decide(SubmissionOutcome::NoConnection) == RetryDecision::Retry,
                 "2nd no-connection -> retry");
    ok &= expect(policy.decide(SubmissionOutcome::NoConnection) == RetryDecision::Retry,
                 "3rd no-connection -> retry");
    ok &= expect(policy.decide(SubmissionOutcome::NoConnection) == RetryDecision::GiveUp,
                 "4th no-connection -> give up (3 retries exhausted, Req 3.5)");
    ok &= expect(policy.connectionFailures() == 4, "connection failures counted");
    return ok;
}

bool testHardDeadline() {
    bool ok = true;
    ok &= expect(!RetryPolicy::hardDeadlineElapsed(0.0), "0s under the 30s ceiling");
    ok &= expect(!RetryPolicy::hardDeadlineElapsed(29.9), "29.9s under the 30s ceiling");
    ok &= expect(RetryPolicy::hardDeadlineElapsed(30.0), "30.0s hits the ceiling (Req 3.3)");
    ok &= expect(RetryPolicy::hardDeadlineElapsed(45.0), "45s past the ceiling");
    return ok;
}

}  // namespace

// Declared in smoke_test.cpp's main(); runs the live-submission example coverage.
bool run_live_submission_tests() {
    bool ok = true;
    ok &= testSerializeShapeAndRoundTrip();
    ok &= testStatusClassification();
    ok &= testConfirmedDequeues();
    ok &= testRejectedAndTimeoutGiveUp();
    ok &= testNoConnectionRetriesUpToThree();
    ok &= testHardDeadline();
    if (ok) {
        std::printf("[live_submission] example tests passed\n");
    }
    return ok;
}
