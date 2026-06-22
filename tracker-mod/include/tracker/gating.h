#pragma once

/**
 * Higher-only live-tracking gating logic (task 10.1).
 *
 * Pure, Geode-SDK-independent logic for the Tracker_Mod's Live_Tracking phase.
 * Depends only on the C++ standard library so it compiles and is property-tested
 * standalone under the -DTRACKER_BUILD_TESTS=ON path (no GD headers, no Geode SDK).
 *
 * Requirements:
 *  - 2.2: emit exactly one submission when a new best percentage is strictly higher
 *         than the previously reported value for that level.
 *  - 2.3: emit on a first-ever completion/observation (no previously reported value),
 *         i.e. "none" is treated as lower than any observed percentage.
 *  - 2.4: withhold the submission when the new percentage is <= the previously
 *         reported value, leaving the last-reported value unchanged.
 *
 * Validates (property test): Property 11 — Higher-only live gating (task 10.5).
 */

#include <optional>
#include <string>
#include <unordered_map>

namespace tracker {

/**
 * Maps a level_id to the last percentage reported (emitted) for that level during
 * the current tracking lifetime. Absence of a key means "none" — no value has ever
 * been reported for that level, which is treated as lower than any observed value.
 *
 * Percentages are integers in [0, 100] for live tracking (Req 2.2 uses 1..100, and
 * 2.3 covers the 100 first-completion case); the gating comparison itself is a pure
 * strict-greater-than test and does not assume a particular range.
 */
using LastReportedMap = std::unordered_map<std::string, int>;

/**
 * Looks up the last-reported percentage for a level, if any.
 *
 * @return the last-reported percentage, or std::nullopt when the level has no
 *         previously reported value ("none").
 */
inline std::optional<int> lastReported(const LastReportedMap& reported,
                                       const std::string& levelId) {
    const auto it = reported.find(levelId);
    if (it == reported.end()) {
        return std::nullopt;
    }
    return it->second;
}

/**
 * Decides whether a submission should be emitted for an observed (levelId, percentage).
 *
 * Rule (Req 2.2, 2.3, 2.4): emit if and only if the new percentage is strictly
 * greater than the last-reported value for that level, treating "none" (no prior
 * entry in `reported`) as lower than any value — so a first observation always emits.
 *
 * This function is pure: it does not modify `reported`. Callers update the map with
 * `recordEmission` after a submission is actually emitted.
 */
inline bool shouldEmit(const LastReportedMap& reported,
                       const std::string& levelId,
                       int newPercentage) {
    const auto prior = lastReported(reported, levelId);
    if (!prior.has_value()) {
        // "none" is lower than any value: a first observation always emits (Req 2.3).
        return true;
    }
    // Strictly greater than the previously reported value (Req 2.2);
    // equal-or-lower is withheld (Req 2.4).
    return newPercentage > *prior;
}

/**
 * Records that a submission was emitted for (levelId, percentage) by updating the
 * last-reported map. Call this only after `shouldEmit` returned true and the
 * submission was emitted, so the map reflects the highest value reported so far.
 *
 * Idempotent with respect to the gating rule: re-applying the same or a lower value
 * never lowers the stored last-reported value.
 */
inline void recordEmission(LastReportedMap& reported,
                           const std::string& levelId,
                           int newPercentage) {
    const auto it = reported.find(levelId);
    if (it == reported.end() || newPercentage > it->second) {
        reported[levelId] = newPercentage;
    }
}

}  // namespace tracker
