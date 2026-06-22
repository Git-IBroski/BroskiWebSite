#pragma once

/**
 * GD-dependent read of local demon completions (Tracker_Mod, Phase 1).
 *
 * This header declares the bridge between Geometry Dash's local state and the
 * pure filtering logic in <tracker/completion_filter.h>. The IMPLEMENTATION
 * (completion_reader.cpp) includes the Geode SDK and therefore can only be
 * compiled on a machine with `GEODE_SDK` configured — it is NOT part of the
 * pure-logic test build (-DTRACKER_BUILD_TESTS=ON).
 *
 * Requirements:
 *   1.2 - extract the Level_ID, level name, and best normal-mode percent for
 *         each locally stored demon completion.
 */

#include <vector>

#include <tracker/completion_filter.h>

namespace tracker {

/**
 * Reads all locally stored demon-level completions from the live GD process.
 *
 * Source (per design, "Geode Hook Strategy, Phase 1"): the per-level best
 * normal-mode percent is stored in the local stats reachable through
 * `GameManager::sharedState()` (GameStatsManager), and online-level metadata
 * (the level name) is cached by `GameLevelManager`. `GJEffectManager` is
 * explicitly NOT a source of completion percent.
 *
 * Returns a list of RAW, unvalidated completions (any field may be missing).
 * Callers MUST pass the result through `filterCompletions()` before upload so
 * that incomplete or out-of-range entries are dropped and counted (Req 1.3).
 */
std::vector<RawCompletion> readLocalCompletions();

}  // namespace tracker
