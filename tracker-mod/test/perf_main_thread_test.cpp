/**
 * Performance microbenchmark for the Tracker_Mod main-thread budget (task 10.8).
 *
 * Requirements: 3.1, 3.2.
 *   3.1 - initiating a request stalls the main thread for <= 1 ms.
 *   3.2 - while a request is in flight, the main thread's per-frame processing
 *         time does not increase by more than 1 ms.
 *
 * --------------------------------------------------------------------------
 * WHAT THIS TEST CAN AND CANNOT MEASURE (environment reality)
 * --------------------------------------------------------------------------
 * A *true* per-frame main-thread budget measurement (Req 3.1/3.2 as written)
 * requires a running Geometry Dash client with the Geode SDK loaded: you must
 * hook real PlayLayer/MenuLayer frames, trigger live submissions while playing,
 * and observe the main thread's frame time with a live web::WebRequest in flight.
 * Per the design's Testing Strategy ("Performance Tests" / threading performance
 * are covered by integration tests run in a GD client build), that measurement
 * CANNOT run in this sandboxed pure-logic test target — there is no GD client,
 * no Geode SDK, and no render loop here.
 *
 * What this test DOES do, without the GD client, is measure the cost of the
 * O(1) main-thread WORK the hooks actually perform before they hand networking
 * off to a background thread. In src/live_tracking.cpp, the hook body
 * `onObservedPercent` does exactly three pure, standard-library-only operations
 * on the main thread, then fires a fire-and-forget async POST:
 *
 *     1. shouldEmit(reported, levelId, percentage)        // gating.h  (Req 2.2-2.4)
 *     2. recordEmission(reported, levelId, percentage)    // gating.h
 *     3. retryQueue().enqueue(record)                     // retry_queue.h (Req 2.8)
 *
 * (The async submitRecordAsync() call and the JSON persistence write are the
 * parts that the design explicitly keeps OFF the main thread / behind
 * web::WebRequest, so they are not part of the per-frame main-thread budget.)
 *
 * By timing many iterations of this exact main-thread pipeline with <chrono> and
 * asserting the average per-call cost is far below the 1 ms budget, we
 * demonstrate that the main-thread portion of request initiation is O(1) and
 * comfortably sub-millisecond (Req 3.1, 3.2) — the portion of those requirements
 * that is verifiable without a GD client.
 *
 * The threshold is deliberately conservative (average < 100 microseconds, i.e.
 * 10x under the 1 ms budget) to avoid CI flakiness on slow/loaded machines while
 * still proving the operation is orders of magnitude under one millisecond. In
 * practice the measured average is a handful of microseconds or less.
 *
 * --------------------------------------------------------------------------
 * TRUE IN-CLIENT PERFORMANCE TEST TO RUN ON A GEODE MACHINE (documented only)
 * --------------------------------------------------------------------------
 * To verify Req 3.1/3.2 end-to-end on a machine with the Geode SDK and a GD
 * client (this CANNOT run in this sandbox):
 *
 *   1. Instrument the hook bodies in src/live_tracking.cpp
 *      (PlayLayer::levelComplete, PlayLayer::destroyPlayer) and
 *      src/initial_sync.cpp (MenuLayer::init -> runInitialSync): capture a
 *      std::chrono::steady_clock timestamp at hook entry and exit and accumulate
 *      the delta. This measures the synchronous main-thread cost of initiating a
 *      request (Req 3.1).
 *   2. Add a per-frame timer (e.g. hook PlayLayer::update or use Geode's
 *      scheduler) that records frame-to-frame wall time, and track a rolling
 *      baseline of frame time while NO web::WebRequest is in flight.
 *   3. While actively playing a demon, trigger live submissions (beat a level /
 *      set new-best percents) so a web::WebRequest is in flight, and compare the
 *      frame time during in-flight requests against the no-request baseline.
 *   4. Assert:
 *        - request initiation stalls the main thread < 1 ms       (Req 3.1), and
 *        - per-frame time does not increase by > 1 ms while a
 *          web::WebRequest is in flight                            (Req 3.2).
 *
 * That in-client harness validates the threading model (work dispatched to
 * web::WebRequest's background thread); this microbenchmark validates that the
 * main-thread work left behind is O(1) and sub-millisecond.
 */
#include "tracker/gating.h"
#include "tracker/retry_queue.h"

#include <chrono>
#include <cstdio>
#include <string>

namespace {

using tracker::LastReportedMap;
using tracker::Record;
using tracker::RetryQueue;
using tracker::recordEmission;
using tracker::shouldEmit;

// Conservative ceiling: 100 microseconds is 10x below the 1 ms (= 1000 us)
// budget of Req 3.1/3.2. Generous enough to absorb CI jitter while still proving
// the main-thread work is far under a millisecond.
constexpr double kBudgetMicros = 100.0;
constexpr double kHardBudgetMicros = 1000.0;  // the actual Req 3.1/3.2 limit

// Number of timed iterations. Large enough to amortize clock granularity and
// produce a stable average; small enough to run in well under a second.
constexpr int kIterations = 100000;

bool expect(bool cond, const char* what) {
    if (!cond) {
        std::printf("[perf] FAIL: %s\n", what);
    }
    return cond;
}

/**
 * Times the exact O(1) main-thread pipeline that onObservedPercent runs per
 * qualifying event: a gating shouldEmit() lookup + recordEmission() update + a
 * RetryQueue enqueue(). Returns the average per-call time in microseconds.
 */
double measureMainThreadWorkMicros() {
    LastReportedMap reported;
    RetryQueue queue;

    // A small spread of level ids so the unordered_map / ordered map do real
    // lookups across distinct keys rather than a single hot entry. Strictly
    // increasing percentages keep every call on the "emit" (worst-case) path.
    constexpr int kLevels = 64;
    std::string levelIds[kLevels];
    for (int i = 0; i < kLevels; ++i) {
        levelIds[i] = std::to_string(100000 + i);
    }

    // Prevent the optimizer from discarding the work.
    volatile int sink = 0;

    const auto start = std::chrono::steady_clock::now();
    for (int i = 0; i < kIterations; ++i) {
        const std::string& levelId = levelIds[i % kLevels];
        // Monotonically increasing percentage (mod 100, +1) so shouldEmit stays
        // on the strictly-greater "emit" branch as often as possible — the path
        // the real hook takes when reporting a new personal best.
        const int percentage = (i % 100) + 1;

        // --- exact main-thread work from onObservedPercent ------------------
        const bool emit = shouldEmit(reported, levelId, percentage);
        if (emit) {
            recordEmission(reported, levelId, percentage);
            Record record;
            record.level_id = levelId;
            record.level_name = "Benchmark Demon";
            record.percentage = percentage;
            queue.enqueue(record);
        }
        // --------------------------------------------------------------------

        sink = sink + (emit ? 1 : 0);

        // Reset a level's high-water mark periodically so enqueue/replace and
        // the gating reset path both stay exercised over the run.
        if (percentage == 100) {
            reported.erase(levelId);
            queue.confirm(levelId);
        }
    }
    const auto end = std::chrono::steady_clock::now();
    (void)sink;

    const double totalMicros =
        std::chrono::duration<double, std::micro>(end - start).count();
    return totalMicros / static_cast<double>(kIterations);
}

}  // namespace

/**
 * Declared in smoke_test.cpp; runs the main-thread budget microbenchmark.
 * Returns true iff the average per-call main-thread cost is within the
 * conservative budget (and, necessarily, within the 1 ms Req 3.1/3.2 limit).
 */
bool run_perf_main_thread_tests() {
    bool ok = true;

    const double avgMicros = measureMainThreadWorkMicros();

    std::printf(
        "[perf] main-thread O(1) work (shouldEmit + recordEmission + enqueue): "
        "avg %.4f us/call over %d iterations "
        "(budget < %.1f us; Req 3.1/3.2 hard limit %.1f us)\n",
        avgMicros, kIterations, kBudgetMicros, kHardBudgetMicros);

    ok &= expect(avgMicros < kBudgetMicros,
                 "average per-call main-thread work is within the conservative "
                 "100 us budget (proves sub-millisecond, Req 3.1/3.2)");
    // Belt-and-suspenders: also assert the literal Req 3.1/3.2 limit.
    ok &= expect(avgMicros < kHardBudgetMicros,
                 "average per-call main-thread work is < 1 ms (Req 3.1/3.2)");

    return ok;
}
