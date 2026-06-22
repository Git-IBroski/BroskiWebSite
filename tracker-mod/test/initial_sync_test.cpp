/**
 * Feature: demon-tier-tracker, Phase 1 example unit tests (task 8.9).
 *
 * Example (not property-based) unit coverage for the pure Phase 1 logic that
 * does not depend on the Geode SDK or GD headers, so it builds and runs under
 * -DTRACKER_BUILD_TESTS=ON on any C++20 toolchain. It links into the single
 * tracker_tests executable via run_initial_sync_example_tests() (declared and
 * called from smoke_test.cpp's main()).
 *
 * Coverage:
 *   - Struct->Record mapping (Req 1.2): a valid RawCompletion maps to a
 *     ValidCompletion with the same level_id/level_name/percentage, exercised
 *     through filterCompletions() on an all-valid input (the same struct->record
 *     mapping the upload set is built from).
 *   - Sync-flag transitions (Req 1.6, 1.7, 1.8): the pure SyncSession state
 *     machine and decideSyncAction() from initial_sync.h. Success sets the
 *     `initial_sync_done` flag; failure leaves it unset (retry next launch);
 *     no-token skips and is recorded as not-completed. isSyncSuccessStatus(200)
 *     is true and any non-200 is false (Req 1.5, 1.6).
 *   - Token presence wiring incl. abort-when-missing (Req 4.4, 4.5): with no
 *     token configured the sync is skipped/aborted, i.e. decideSyncAction with
 *     hasToken=false yields SkipNoToken.
 *
 * Validates: Requirements 1.2, 1.6, 1.7, 1.8, 4.4, 4.5
 *
 * These are plain example assertions (via rapidcheck's RC_ASSERT inside a single
 * deterministic check) rather than randomized properties: they pin specific,
 * representative cases of the Phase 1 rules.
 */
#include <rapidcheck.h>

#include <string>
#include <vector>

#include <tracker/completion_filter.h>
#include <tracker/initial_sync.h>

namespace {

using tracker::FilterResult;
using tracker::RawCompletion;
using tracker::SyncAction;
using tracker::SyncOutcome;
using tracker::SyncSession;
using tracker::ValidCompletion;
using tracker::decideSyncAction;
using tracker::filterCompletions;
using tracker::isSyncSuccessStatus;

// Plain example assertion helper. RC_ASSERT requires a rapidcheck context, so we
// run the example checks inside a single deterministic rc::check invocation that
// takes no generated input (its body runs once and either holds or fails).

// Req 1.2: a valid RawCompletion maps to a ValidCompletion that preserves the
// level_id, level_name, and percentage. This is the struct->record mapping the
// upload set is built from, exercised via filterCompletions on all-valid input.
void check_struct_to_record_mapping() {
    const std::vector<RawCompletion> raw = {
        RawCompletion{"12345", "Bloodbath", 100},
        RawCompletion{"67890", "Sonic Wave", 73},
        RawCompletion{"42", "Tartarus", 0},
    };

    const FilterResult result = filterCompletions(raw);

    // All inputs are valid: nothing skipped, count preserved (Req 1.2).
    RC_ASSERT(result.skipped == 0u);
    RC_ASSERT(result.valid.size() == raw.size());

    // Each ValidCompletion carries the same fields as its RawCompletion source.
    const std::vector<ValidCompletion> expected = {
        ValidCompletion{"12345", "Bloodbath", 100},
        ValidCompletion{"67890", "Sonic Wave", 73},
        ValidCompletion{"42", "Tartarus", 0},
    };
    RC_ASSERT(result.valid == expected);

    // Field-by-field on a representative entry, to be explicit about the mapping.
    RC_ASSERT(result.valid[0].level_id == raw[0].level_id);
    RC_ASSERT(result.valid[0].level_name == raw[0].level_name);
    RC_ASSERT(result.valid[0].percentage == raw[0].percentage.value());
}

// Req 1.5, 1.6: only an HTTP 200 counts as a successful sync response.
void check_sync_success_status() {
    RC_ASSERT(isSyncSuccessStatus(200) == true);
    RC_ASSERT(isSyncSuccessStatus(0) == false);
    RC_ASSERT(isSyncSuccessStatus(201) == false);
    RC_ASSERT(isSyncSuccessStatus(204) == false);
    RC_ASSERT(isSyncSuccessStatus(400) == false);
    RC_ASSERT(isSyncSuccessStatus(401) == false);
    RC_ASSERT(isSyncSuccessStatus(500) == false);
    RC_ASSERT(isSyncSuccessStatus(503) == false);
}

// Req 1.1, 1.7, 4.4, 4.5: decideSyncAction over (hasToken, syncDone).
void check_decide_sync_action() {
    // Token present, sync not yet done -> attempt the sync (Req 1.1, 4.4).
    RC_ASSERT(decideSyncAction(/*hasToken=*/true, /*syncDone=*/false) ==
              SyncAction::Attempt);

    // No token configured -> skip/abort the sync (Req 1.7, 4.5).
    RC_ASSERT(decideSyncAction(/*hasToken=*/false, /*syncDone=*/false) ==
              SyncAction::SkipNoToken);

    // Already synced this session -> do nothing, regardless of token (precedence).
    RC_ASSERT(decideSyncAction(/*hasToken=*/true, /*syncDone=*/true) ==
              SyncAction::AlreadyDone);
    RC_ASSERT(decideSyncAction(/*hasToken=*/false, /*syncDone=*/true) ==
              SyncAction::AlreadyDone);
}

// Req 1.6: a successful sync sets the session flag and records Succeeded.
void check_session_success_sets_flag() {
    SyncSession session;
    // Fresh session: flag unset, no attempt yet.
    RC_ASSERT(session.isDone() == false);
    RC_ASSERT(session.wasAttempted() == false);
    RC_ASSERT(session.outcome() == SyncOutcome::NotAttempted);

    session.markInProgress();
    RC_ASSERT(session.outcome() == SyncOutcome::InProgress);
    RC_ASSERT(session.wasAttempted() == true);
    RC_ASSERT(session.isDone() == false);  // not done until 200 received

    session.markSucceeded();
    RC_ASSERT(session.isDone() == true);  // initial_sync_done set (Req 1.6)
    RC_ASSERT(session.outcome() == SyncOutcome::Succeeded);
}

// Req 1.8: a failed/timed-out sync leaves the flag unset so it retries next
// launch.
void check_session_failure_leaves_flag_unset() {
    SyncSession session;
    session.markInProgress();
    session.markFailed();
    RC_ASSERT(session.isDone() == false);  // unset -> retried next launch (Req 1.8)
    RC_ASSERT(session.outcome() == SyncOutcome::Failed);
    RC_ASSERT(session.wasAttempted() == true);
}

// Req 1.7, 4.5: with no token the sync is skipped and recorded as not-completed.
void check_session_no_token_skips() {
    SyncSession session;
    session.markSkippedNoToken();
    RC_ASSERT(session.isDone() == false);  // flag stays unset (Req 1.7)
    RC_ASSERT(session.outcome() == SyncOutcome::SkippedNoToken);
    // A skip still counts as "attempted" for the once-per-launch dispatch guard.
    RC_ASSERT(session.wasAttempted() == true);
}

// Req 4.4, 4.5: token-presence wiring. When a token is present the hook attempts
// and, on success, the flag is set; when absent the sync is aborted/skipped and
// the flag never gets set.
void check_token_presence_wiring() {
    // Token present -> Attempt -> a 200 sets the flag (Req 4.4).
    {
        const bool hasToken = true;
        SyncSession session;
        const SyncAction action = decideSyncAction(hasToken, session.isDone());
        RC_ASSERT(action == SyncAction::Attempt);
        session.markInProgress();
        if (isSyncSuccessStatus(200)) {
            session.markSucceeded();
        }
        RC_ASSERT(session.isDone() == true);
    }

    // Token absent -> SkipNoToken -> abort, flag never set (Req 4.5).
    {
        const bool hasToken = false;
        SyncSession session;
        const SyncAction action = decideSyncAction(hasToken, session.isDone());
        RC_ASSERT(action == SyncAction::SkipNoToken);
        session.markSkippedNoToken();
        RC_ASSERT(session.isDone() == false);
        RC_ASSERT(session.outcome() == SyncOutcome::SkippedNoToken);
    }
}

}  // namespace

// Declared in smoke_test.cpp's main(); runs the Phase 1 example unit tests.
bool run_initial_sync_example_tests() {
    bool ok = true;

    ok &= rc::check(
        "task 8.9: Phase 1 example unit tests (struct->record mapping, sync-flag "
        "transitions, token-presence wiring)",
        [] {
            check_struct_to_record_mapping();    // Req 1.2
            check_sync_success_status();         // Req 1.5, 1.6
            check_decide_sync_action();          // Req 1.1, 1.7, 4.4, 4.5
            check_session_success_sets_flag();   // Req 1.6
            check_session_failure_leaves_flag_unset();  // Req 1.8
            check_session_no_token_skips();      // Req 1.7, 4.5
            check_token_presence_wiring();       // Req 4.4, 4.5
        });

    return ok;
}
