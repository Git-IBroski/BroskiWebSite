/**
 * Tracker_Mod — Live_Tracking hooks and enqueue wiring (task 10.3, implementation).
 *
 * Hooks the completion / percent-update events and, on a qualifying higher-only
 * event, does O(1) work on the main thread (compare + enqueue) then hands the
 * Record off to the asynchronous networking entry point (`submitRecordAsync`,
 * implemented by task 10.4). All real networking happens off the main thread, so
 * these hook bodies honor the ≤1 ms main-thread budget (Req 3.1).
 *
 * This translation unit includes the Geode SDK and GD class headers, so it can
 * ONLY be compiled on a machine with `GEODE_SDK` configured. It is excluded from
 * the pure-logic test build (-DTRACKER_BUILD_TESTS=ON); the logic it relies on is
 * the standard-library-only `tracker::shouldEmit` / `tracker::recordEmission`
 * (gating.h, task 10.1) and `tracker::RetryQueue` (retry_queue.h, task 10.2),
 * which are property-tested standalone (Properties 11, 12).
 *
 * Requirements:
 *   2.1 - while Initial_Sync is set, monitor completion / progress-update events.
 *   2.2 - on a strictly-higher Best_Percentage, send exactly one Record.
 *   2.3 - on a first-ever completion (100%, no prior value), send exactly one Record.
 *   2.5 - while Initial_Sync is unset, withhold all live submissions.
 *   3.1 - keep the hook body O(1) on the main thread; dispatch networking off-thread.
 */
#include "live_tracking.hpp"

#include <algorithm>
#include <string>

#include <Geode/Geode.hpp>
#include <Geode/modify/PlayLayer.hpp>

#include "session_state.hpp"
#include "tracker/gating.h"
#include "tracker/retry_queue.h"

using namespace geode::prelude;

namespace tracker {

namespace {

// Geode mod save-dir key under which the retry queue is persisted as JSON so it
// survives launches (Req 2.6). The queue itself enforces one-entry-per-level
// (Req 2.8); we persist its JSON on every change.
constexpr const char* kRetryQueueSavedKey = "retry-queue";

// In-memory last-reported map (gating.h). Holds the highest percentage already
// emitted for each level this tracking lifetime; "absent" means none reported.
// Touched only from the main thread inside the hooks, so it needs no locking.
LastReportedMap& lastReportedMap() {
    static LastReportedMap map;
    return map;
}

// The persisted retry queue (retry_queue.h). Lazily hydrated from the mod save
// dir on first access so a queue left over from a previous launch is retried
// (Req 2.6). Also touched only from the main thread.
RetryQueue& retryQueue() {
    static RetryQueue queue;
    static bool loaded = false;
    if (!loaded) {
        loaded = true;
        const std::string json =
            Mod::get()->getSavedValue<std::string>(kRetryQueueSavedKey, "[]");
        if (auto restored = RetryQueue::fromJson(json)) {
            queue = std::move(*restored);
        } else {
            // A corrupt save degrades to an empty queue rather than crashing.
            log::warn("Demon Tier Tracker: retry queue save was malformed; "
                      "starting with an empty queue.");
        }
    }
    return queue;
}

// Persists the current retry queue to the mod save dir (Req 2.6). Cheap at this
// scale (≤ one entry per demon level) and only called when the queue changes.
void persistRetryQueue() {
    Mod::get()->setSavedValue<std::string>(kRetryQueueSavedKey, retryQueue().toJson());
}

/**
 * Core Live_Tracking step for one observed (levelId, levelName, percentage).
 *
 * Runs on the main thread and is intentionally O(1): a hash-map lookup, an
 * optional enqueue, and a single dispatch into the async networking layer.
 *
 *   1. Withhold everything while Initial_Sync is unset (Req 2.5).
 *   2. Ignore out-of-range percentages (live tracking covers 1..100; Req 2.2/2.3).
 *   3. Higher-only gating: emit iff strictly greater than the last reported value
 *      for this level, treating "none" as lower than any value (Req 2.2-2.4).
 *   4. On emit: record the new high-water mark, enqueue (persist), and fire the
 *      async POST. The POST runs off-thread (Req 3.1); the queue entry is removed
 *      later on confirmation (Req 2.7) by task 10.4 via confirmLiveSubmission.
 */
void onObservedPercent(const std::string& levelId,
                       const std::string& levelName,
                       int percentage) {
    // (Req 2.5) Withhold all live submissions until Initial_Sync has completed.
    // Pending Records already in the retry queue are retained for later.
    if (!isInitialSyncDone()) {
        return;
    }

    // Defensive bounds: a live Best_Percentage is an integer in 1..100
    // (Req 2.2/2.3). 0% or garbage from an early/partial frame is not a result.
    if (levelId.empty() || percentage < 1 || percentage > 100) {
        return;
    }

    auto& reported = lastReportedMap();

    // (Req 2.2, 2.3, 2.4) Strictly-higher gating; first observation always emits.
    if (!shouldEmit(reported, levelId, percentage)) {
        return;
    }

    // Update the in-memory high-water mark so the same value never re-emits.
    recordEmission(reported, levelId, percentage);

    // Enqueue (one-per-level, highest pct) and persist so the Record survives a
    // crash/quit before the POST is confirmed (Req 2.6, 2.8).
    Record record;
    record.level_id = levelId;
    record.level_name = levelName;
    record.percentage = percentage;
    if (retryQueue().enqueue(record)) {
        persistRetryQueue();
    }

    // Fire-and-forget async submission (Req 2.2, 2.3, 3.1). Defined by task 10.4.
    submitRecordAsync(record);
}

// Extracts a level's id (as a string) and name from a GJGameLevel, mirroring the
// shape produced by the Phase 1 reader (completion_reader.cpp).
struct LevelKey {
    std::string id;
    std::string name;
    bool isDemon = false;
};

LevelKey levelKeyOf(GJGameLevel* level) {
    LevelKey key;
    if (level == nullptr) {
        return key;
    }
    key.id = std::to_string(level->m_levelID.value());
    key.name = std::string(level->m_levelName);
    key.isDemon = level->m_demon;
    return key;
}

}  // namespace

// Defined here (task 10.3); called by task 10.4's success-confirmation callback
// to remove a confirmed Record from the persisted retry queue (Req 2.7).
void confirmLiveSubmission(const std::string& levelId) {
    if (retryQueue().confirm(levelId)) {
        persistRetryQueue();
    }
}

}  // namespace tracker

// ---------------------------------------------------------------------------
// PlayLayer hooks (design: Geode Hook Strategy, Phase 2 — Live Tracking).
//
// `$modify` self-registers from this translation unit, so it coexists with the
// `MenuLayer::init` hook in main.cpp (task 8.5) without any shared registration.
// ---------------------------------------------------------------------------
class $modify(TrackerPlayLayer, PlayLayer) {
    // Full completion (100%) path (Req 2.3). Called once when the level is beaten.
    void levelComplete() {
        PlayLayer::levelComplete();

        const auto key = tracker::levelKeyOf(m_level);
        if (!key.isDemon) {
            return;  // only demon-difficulty levels feed the tier list
        }
        // A completion is by definition 100% (Req 2.3).
        tracker::onObservedPercent(key.id, key.name, 100);
    }

    // Percent-update path for new-best PARTIAL percentages (Req 2.2). destroyPlayer
    // fires on each death; the higher-only gating inside onObservedPercent ensures
    // we only emit when this attempt beat the best already reported this session.
    void destroyPlayer(PlayerObject* player, GameObject* object) {
        PlayLayer::destroyPlayer(player, object);

        // Practice-mode deaths are not real personal bests (design: best
        // NORMAL-mode percent), so they are ignored.
        if (m_isPracticeMode) {
            return;
        }

        const auto key = tracker::levelKeyOf(m_level);
        if (!key.isDemon) {
            return;
        }

        // O(1) read of the current run's percent as an integer 0..100.
        const int percent =
            std::clamp(this->getCurrentPercentInt(), 0, 100);
        tracker::onObservedPercent(key.id, key.name, percent);
    }
};
