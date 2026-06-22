/**
 * Tracker_Mod — Live_Tracking async networking (task 10.4, implementation).
 *
 * Defines `tracker::submitRecordAsync` (the seam declared by task 10.3 in
 * `live_tracking.hpp`) and the `tracker::retryPersistedQueue` flush entry point.
 *
 * Geode v5 web API note: the old `EventListener<web::WebTask>` callback model was
 * removed in favor of `arc` futures (`WebRequest::post` returns a `WebFuture`)
 * plus a synchronous `postSync`. To keep this layer simple, robust, and entirely
 * off the game's main thread, each submission runs on its own detached
 * `std::thread` using `postSync`, and any shared-state mutation (the persisted
 * retry queue) is marshalled back to the main thread via
 * `Loader::queueInMainThread`. The calling hook therefore only does O(1)
 * main-thread work (Req 3.1, honored by the 10.3 hook bodies that call this).
 *
 * Per-submission policy (design: "Networking, Queue, and Persistence"):
 *   - POST the single-object body to the Records_API with the X-Player-Token
 *     header (Req 3.2, 4.4); abort with a notice if no token is configured (Req 4.5).
 *   - 10 s success-confirmation window per attempt (Req 2.6): on HTTP 200 dequeue
 *     via confirmLiveSubmission (Req 2.7); otherwise leave the Record queued.
 *   - up to 3 connection retries when no connection can be established / the
 *     attempt times out (Req 3.5). A libcurl transport error or a transfer
 *     timeout surfaces as a non-positive HTTP code.
 *   - 30 s hard-cancel ceiling across attempts (Req 3.3).
 *   - any non-success response is logged and gameplay continues unmodified (Req 3.4).
 *
 * This translation unit includes the Geode SDK, so it can ONLY be compiled with
 * `GEODE_SDK` configured. It is excluded from the pure-logic test build
 * (-DTRACKER_BUILD_TESTS=ON); the pure logic it relies on (RetryPolicy,
 * serializeLiveRecord) lives in <tracker/live_submission.h> and is tested there.
 *
 * Requirements: 2.6, 2.7, 3.2, 3.3, 3.4, 3.5.
 */
#include "networking.hpp"

#include <chrono>
#include <optional>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#include <Geode/Geode.hpp>
#include <Geode/utils/web.hpp>

#include <tracker/initial_sync.h>   // isSyncSuccessStatus (HTTP 200 == success)
#include <tracker/retry_queue.h>    // Record, RetryQueue

#include "initial_sync.hpp"         // kRecordsApiUrl, kPlayerTokenHeader (shared endpoint)
#include "live_tracking.hpp"        // submitRecordAsync decl + confirmLiveSubmission
#include "token_setting.hpp"        // getConfiguredToken

using namespace geode::prelude;

namespace tracker {

namespace {

// Geode mod save-dir key under which the retry queue is persisted. MUST match the
// key used by `live_tracking.cpp` (task 10.3) so this flush reads the same store.
constexpr const char* kRetryQueueSavedKey = "retry-queue";

/**
 * Performs one Live_Tracking submission to completion on a background thread.
 *
 * Drives the pure `RetryPolicy` against repeated synchronous POSTs:
 *   - each attempt has a 10 s confirmation window via `WebRequest::timeout`
 *     (Req 2.6); a timeout or transport failure yields a non-positive code,
 *     classified as NoConnection so the policy retries up to 3 times (Req 3.5);
 *   - the 30 s hard-cancel ceiling is enforced across attempts (Req 3.3);
 *   - HTTP 200 confirms and dequeues on the main thread (Req 2.7); any other
 *     response stops and leaves the Record queued (Req 3.4); a give-up for any
 *     reason leaves the Record persisted for a later attempt (Req 2.6).
 *
 * The Record is presumed to already live in the persisted retry queue (task 10.3
 * enqueues + persists before calling submitRecordAsync), so only a confirmed
 * HTTP 200 mutates the queue — and that mutation is marshalled to the main thread.
 */
void runSubmission(std::string token, Record record) {
    const std::string body = serializeLiveRecord(record);
    const auto start = std::chrono::steady_clock::now();
    RetryPolicy policy;

    const auto elapsedSeconds = [&start]() -> double {
        return std::chrono::duration<double>(
                   std::chrono::steady_clock::now() - start)
            .count();
    };

    while (true) {
        // Req 3.3: enforce the overall 30 s ceiling before issuing an attempt.
        if (RetryPolicy::hardDeadlineElapsed(elapsedSeconds())) {
            log::warn(
                "Demon Tier Tracker: live submission for level {} hit the {}s "
                "ceiling; left queued for later retry.",
                record.level_id, kLiveHardCancelSeconds);
            return;
        }

        policy.recordAttempt();

        web::WebRequest request;
        request.header(kPlayerTokenHeader, token);            // Req 4.4
        request.header("Content-Type", "application/json");
        request.bodyString(body);                             // Req 3.2 single-object body
        // 10 s success-confirmation window (Req 2.6). postSync blocks this worker
        // thread (never the main thread) until a response, error, or timeout.
        request.timeout(std::chrono::seconds(kLiveConfirmationTimeoutSeconds));

        const web::WebResponse response = request.postSync(kRecordsApiUrl);
        const int status = response.code();

        SubmissionOutcome outcome;
        if (isSyncSuccessStatus(status)) {
            outcome = SubmissionOutcome::Confirmed;            // Req 2.7
        } else if (status <= 0) {
            // No HTTP status: a transport error or a timeout of the 10 s window
            // (Req 2.6, 3.5). Retried as a connection failure up to the cap.
            outcome = SubmissionOutcome::NoConnection;
        } else {
            outcome = SubmissionOutcome::RejectedResponse;     // Req 3.4
        }

        const RetryDecision decision = policy.decide(outcome);
        if (decision == RetryDecision::Dequeue) {
            // Req 2.7: confirmed receipt -> remove from the persisted queue on the
            // main thread, where all queue mutations are serialized.
            const std::string levelId = record.level_id;
            const int pct = record.percentage;
            Loader::get()->queueInMainThread([levelId, pct]() {
                confirmLiveSubmission(levelId);
                log::info(
                    "Demon Tier Tracker: live submission confirmed for level {} "
                    "({}%).",
                    levelId, pct);
            });
            return;
        }
        if (decision == RetryDecision::Retry) {               // Req 3.5
            log::warn(
                "Demon Tier Tracker: no connection/timeout submitting level {} "
                "(attempt {} of {}); retrying.",
                record.level_id, policy.attempts(), kMaxConnectionRetries + 1);
            continue;
        }
        // RetryDecision::GiveUp (Req 2.6 / 3.3 / 3.4): log and stop; the Record
        // stays queued for the next qualifying event or launch.
        log::warn(
            "Demon Tier Tracker: live submission for level {} not confirmed "
            "(status {}); left queued for later retry.",
            record.level_id, status);
        return;
    }
}

}  // namespace

// Definition of the seam declared by task 10.3 in live_tracking.hpp. Called on
// the main thread from the PlayLayer hooks; returns immediately after spawning
// the background submission so the hook body stays O(1) (Req 3.1, 3.2).
void submitRecordAsync(const Record& record) {
    if (record.level_id.empty()) {
        return;  // nothing addressable to submit
    }

    // Req 4.4 / 4.5: attribute by the configured token, or abort with a notice if
    // none is set. The Record is left in the retry queue so it is submitted once a
    // token is configured (Req 2.6). Read the token here on the main thread.
    const std::optional<std::string> token = getConfiguredToken();
    if (!token.has_value()) {
        log::warn(
            "Demon Tier Tracker: live submission aborted for level {} — no Secret "
            "Player Token configured.",
            record.level_id);
        Notification::create(
            "Demon Tier Tracker: set your Secret Player Token to upload completions.",
            NotificationIcon::Warning)
            ->show();
        return;
    }

    // Fire-and-forget on a detached worker thread (Req 3.2 off the main thread).
    std::thread(runSubmission, *token, record).detach();
}

void retryPersistedQueue() {
    // Without a token nothing can be attributed (Req 4.5); keep the queue as-is so
    // a later launch with a token configured still flushes it.
    if (!getConfiguredToken().has_value()) {
        return;
    }

    // Read (never write) the same persisted store live_tracking.cpp maintains.
    const std::string json =
        Mod::get()->getSavedValue<std::string>(kRetryQueueSavedKey, "[]");
    const std::optional<RetryQueue> queue = RetryQueue::fromJson(json);
    if (!queue.has_value()) {
        log::warn(
            "Demon Tier Tracker: persisted retry queue malformed; skipping flush.");
        return;
    }

    const std::vector<Record> pending = queue->records();
    if (pending.empty()) {
        return;  // nothing to retry
    }

    log::info("Demon Tier Tracker: flushing {} queued live record(s).",
              pending.size());
    for (const Record& record : pending) {
        // Confirmed submissions dequeue themselves via confirmLiveSubmission;
        // unconfirmed ones remain queued for the next attempt (Req 2.6, 2.7).
        submitRecordAsync(record);
    }
}

}  // namespace tracker
