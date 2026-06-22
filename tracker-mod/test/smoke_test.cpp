/**
 * Scaffold smoke test for the Tracker_Mod pure-logic test target (task 8.1).
 *
 * Its only job is to prove the rapidcheck property-testing harness is wired up
 * and runs independently of the Geode SDK. The real pure-logic property tests
 * (Properties 9, 10, 13, 11, 12) are added in tasks 8.6-8.8 and 10.5-10.6.
 *
 * The test target is configured to run >= 100 iterations per property via
 * RC_PARAMS=max_success=100 (set in test/CMakeLists.txt and the rapidcheck
 * default), satisfying the design's minimum-iteration requirement.
 */
#include <rapidcheck.h>

#include <algorithm>
#include <vector>

// Defined in token_test.cpp (task 8.2): example/unit coverage for the pure token
// validator. Declared here so the single test executable runs it.
bool run_token_tests();

// Defined in retry_queue_example_test.cpp (task 10.2): example coverage for the
// pure persisted retry queue. Declared here so the single executable runs it.
bool run_retry_queue_example_tests();

// Defined in live_submission_test.cpp (task 10.4): example coverage for the pure
// Live_Tracking submission logic (payload serialization + retry policy). Declared
// here so the single executable runs it.
bool run_live_submission_tests();

// Defined in completion_filter_test.cpp (task 8.6): Property 9 local completion
// filtering. Declared here so the single executable runs it.
bool run_completion_filter_tests();

// Defined in serialization_test.cpp (task 8.7): Property 10 completion
// serialization round-trip. Declared here so the single executable runs it.
bool run_serialization_tests();

// Defined in token_property_test.cpp (task 8.8): Property 13 whitespace token
// rejection. Declared here so the single executable runs it.
bool run_token_property_tests();

// Defined in gating_property_test.cpp (task 10.5): Property 11 higher-only live
// gating. Declared here so the single executable runs it.
bool run_gating_property_tests();

// Defined in retry_queue_property_test.cpp (task 10.6): Property 12 retry queue
// keeps one highest entry per level. Declared here so the single executable runs it.
bool run_retry_queue_property_tests();

// Defined in initial_sync_test.cpp (task 8.9): example unit tests for Phase 1
// (struct->record mapping, sync-flag transitions, token-presence wiring).
// Declared here so the single executable runs it.
bool run_initial_sync_example_tests();

// Defined in networking_integration_test.cpp (task 10.7): integration simulation
// of the Live_Tracking networking decision logic (retry-3-on-no-connection, 10s
// queue-on-timeout, 30s hard cancel). Declared here so the single executable runs it.
bool run_networking_integration_tests();

// Defined in perf_main_thread_test.cpp (task 10.8): microbenchmark of the O(1)
// main-thread work the hooks perform (shouldEmit + recordEmission + enqueue),
// asserting it is far under the 1 ms budget (Req 3.1, 3.2). Declared here so the
// single executable runs it.
bool run_perf_main_thread_tests();

int main() {
    bool ok = true;

    // Sanity property: reversing a list twice yields the original list.
    // Confirms generators, shrinking, and assertions all work end-to-end.
    ok &= rc::check("scaffold: reverse is its own inverse", [](const std::vector<int>& xs) {
        std::vector<int> twice = xs;
        std::reverse(twice.begin(), twice.end());
        std::reverse(twice.begin(), twice.end());
        RC_ASSERT(twice == xs);
    });

    // Pure token-validation coverage (task 8.2).
    ok &= run_token_tests();

    // Pure retry-queue example coverage (task 10.2).
    ok &= run_retry_queue_example_tests();

    // Pure live-submission example coverage (task 10.4).
    ok &= run_live_submission_tests();

    // Property 9: local completion filtering (task 8.6).
    ok &= run_completion_filter_tests();

    // Property 10: completion serialization round-trip (task 8.7).
    ok &= run_serialization_tests();

    // Property 13: whitespace token rejection (task 8.8).
    ok &= run_token_property_tests();

    // Property 11: higher-only live gating (task 10.5).
    ok &= run_gating_property_tests();

    // Property 12: retry queue keeps one highest entry per level (task 10.6).
    ok &= run_retry_queue_property_tests();

    // Phase 1 example unit tests (task 8.9).
    ok &= run_initial_sync_example_tests();

    // Networking integration simulation (task 10.7).
    ok &= run_networking_integration_tests();

    // Main-thread budget microbenchmark (task 10.8).
    ok &= run_perf_main_thread_tests();

    return ok ? 0 : 1;
}
