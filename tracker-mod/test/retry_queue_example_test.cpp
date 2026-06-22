/**
 * Example/unit coverage for the pure persisted retry queue (task 10.2).
 *
 * Verifies the header in include/tracker/retry_queue.h compiles standalone under
 * the -DTRACKER_BUILD_TESTS=ON path (no Geode SDK) and that its core behaviours
 * hold on representative examples:
 *   - one entry per level_id, keeping the highest percentage (Req 2.8),
 *   - removal on confirmation (Req 2.7),
 *   - JSON serialize/parse round-trip used for persistence (Req 2.6).
 *
 * The exhaustive property test (Property 12) is task 10.6; this file is only the
 * example-level smoke coverage that keeps task 10.2 self-verifying.
 */
#include "tracker/retry_queue.h"

#include <cstdio>
#include <string>

namespace {

using tracker::Record;
using tracker::RetryQueue;

bool expect(bool cond, const char* what) {
    if (!cond) {
        std::printf("[retry_queue] FAIL: %s\n", what);
    }
    return cond;
}

bool testOneEntryHighestPerLevel() {
    RetryQueue q;
    q.enqueue(Record{"100", "Demon A", 40});
    q.enqueue(Record{"100", "Demon A", 73});   // higher -> replaces
    q.enqueue(Record{"100", "Demon A", 50});   // lower  -> ignored
    q.enqueue(Record{"200", "Demon B", 10});

    bool ok = true;
    ok &= expect(q.size() == 2, "two distinct levels queued");
    ok &= expect(q.get("100").has_value() && q.get("100")->percentage == 73,
                 "level 100 retains highest percentage (73)");
    ok &= expect(q.get("200").has_value() && q.get("200")->percentage == 10,
                 "level 200 present at 10");
    return ok;
}

bool testConfirmRemoves() {
    RetryQueue q;
    q.enqueue(Record{"100", "Demon A", 73});
    q.enqueue(Record{"200", "Demon B", 10});

    bool ok = true;
    ok &= expect(q.confirm("100"), "confirm removes existing entry");
    ok &= expect(!q.contains("100"), "confirmed level absent");
    ok &= expect(!q.confirm("999"), "confirm of absent level is a no-op");
    ok &= expect(q.size() == 1, "one entry remains after confirmation");
    return ok;
}

bool testJsonRoundTrip() {
    RetryQueue q;
    q.enqueue(Record{"44622744", "Tartarus", 41});
    q.enqueue(Record{"128", "Theory of \"Everything\" 2\n\t", 100});  // tricky chars

    const std::string json = q.toJson();
    const auto parsed = RetryQueue::fromJson(json);

    bool ok = true;
    ok &= expect(parsed.has_value(), "round-trip parse succeeds");
    if (parsed.has_value()) {
        ok &= expect(parsed->records() == q.records(),
                     "parsed queue equals original");
    }

    // Empty queue round-trips to "[]".
    RetryQueue empty;
    ok &= expect(empty.toJson() == "[]", "empty queue serializes to []");
    const auto parsedEmpty = RetryQueue::fromJson("[]");
    ok &= expect(parsedEmpty.has_value() && parsedEmpty->empty(),
                 "empty array parses to empty queue");

    // Malformed input degrades to nullopt (not a crash).
    ok &= expect(!RetryQueue::fromJson("not json").has_value(),
                 "malformed input rejected");
    return ok;
}

}  // namespace

// Declared in smoke_test.cpp's main(); runs the retry-queue example coverage.
bool run_retry_queue_example_tests() {
    bool ok = true;
    ok &= testOneEntryHighestPerLevel();
    ok &= testConfirmRemoves();
    ok &= testJsonRoundTrip();
    if (ok) {
        std::printf("[retry_queue] example tests passed\n");
    }
    return ok;
}
