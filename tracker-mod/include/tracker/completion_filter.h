#pragma once

/**
 * Pure, Geode-independent local-completion filtering (Tracker_Mod, Phase 1).
 *
 * This header has NO dependency on the Geode SDK or Geometry Dash headers: it
 * depends only on the C++ standard library, so it can be unit- and
 * property-tested on any machine with a C++20 toolchain (Property 9, task 8.6).
 *
 * The GD-dependent read of per-level completion data (level id, name, and best
 * normal-mode percent from GameManager::sharedState() ->
 * GameStatsManager/GameLevelManager) lives in `src/completion_reader.*` and
 * produces a list of `RawCompletion`. That list is then passed through
 * `filterCompletions()` here to produce the upload set.
 *
 * Requirements:
 *   1.2 - extract Level_ID, level name, and Best_Percentage for each completion.
 *   1.3 - exclude completions missing the Level_ID, the level name, or the
 *         Best_Percentage, or with a Best_Percentage outside 0..100, and record
 *         that they were skipped as invalid.
 */

#include <cstddef>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace tracker {

// Inclusive bounds for a valid Best_Percentage (Req 1.2, 1.3).
inline constexpr int kMinPercentage = 0;
inline constexpr int kMaxPercentage = 100;

/**
 * A raw, unvalidated completion as read from local game memory.
 *
 * Any field may be "missing":
 *   - `level_id` / `level_name` are considered missing when empty.
 *   - `percentage` is missing when the optional holds no value.
 *
 * Modeling missing fields explicitly lets the filter (and Property 9) exercise
 * every "missing X" branch of Requirement 1.3 without any GD dependency.
 */
struct RawCompletion {
    std::string level_id;            // missing => empty string
    std::string level_name;          // missing => empty string
    std::optional<int> percentage;   // missing => std::nullopt
};

/**
 * A validated completion: guaranteed non-empty `level_id` and `level_name` and a
 * `percentage` in [0, 100]. This is the shape that is uploaded to the Records_API.
 */
struct ValidCompletion {
    std::string level_id;
    std::string level_name;
    int percentage = 0;
};

inline bool operator==(const ValidCompletion& a, const ValidCompletion& b) {
    return a.level_id == b.level_id &&
           a.level_name == b.level_name &&
           a.percentage == b.percentage;
}

inline bool operator!=(const ValidCompletion& a, const ValidCompletion& b) {
    return !(a == b);
}

/**
 * The outcome of filtering a batch of raw completions: the valid upload set, in
 * input order, plus the number of entries skipped as invalid (Req 1.3).
 */
struct FilterResult {
    std::vector<ValidCompletion> valid;
    std::size_t skipped = 0;
};

/**
 * Returns true iff `c` is a complete, in-range completion (Req 1.2, 1.3):
 * it has a non-empty level id, a non-empty level name, a present percentage, and
 * that percentage lies within [kMinPercentage, kMaxPercentage].
 */
inline bool isValidCompletion(const RawCompletion& c) {
    if (c.level_id.empty()) {
        return false;
    }
    if (c.level_name.empty()) {
        return false;
    }
    if (!c.percentage.has_value()) {
        return false;
    }
    const int pct = *c.percentage;
    return pct >= kMinPercentage && pct <= kMaxPercentage;
}

/**
 * Pure filter (Req 1.3 / Property 9).
 *
 * Given a list of raw completions, drops every entry that is missing its
 * level_id, level_name, or percentage, or whose percentage falls outside
 * 0..100, and keeps the rest in their original order. Returns both the valid
 * upload set and a count of how many entries were skipped as invalid.
 *
 * Invariant: `result.valid.size() + result.skipped == raw.size()`.
 */
inline FilterResult filterCompletions(const std::vector<RawCompletion>& raw) {
    FilterResult result;
    result.valid.reserve(raw.size());
    for (const auto& c : raw) {
        if (isValidCompletion(c)) {
            result.valid.push_back(ValidCompletion{c.level_id, c.level_name, *c.percentage});
        } else {
            ++result.skipped;
        }
    }
    return result;
}

}  // namespace tracker
