/**
 * GD-dependent read of local demon completions (Tracker_Mod, Phase 1).
 *
 * This translation unit includes the Geode SDK and the GD class headers, so it
 * can only be compiled on a machine with `GEODE_SDK` configured. It is excluded
 * from the pure-logic test build (-DTRACKER_BUILD_TESTS=ON), which compiles only
 * the standard-library-only headers under include/tracker/.
 *
 * Responsibility: read per-level `levelID`, level name, and best normal-mode
 * percent for every locally known demon level, returning RAW completions. The
 * caller filters/validates them via tracker::filterCompletions() (Req 1.3).
 *
 * Requirements: 1.2 (extract Level_ID, level name, Best_Percentage).
 *
 * NOTE ON GD INTERNALS: the exact member/accessor names for cached online levels
 * and the stored normal percent depend on the bindings shipped with the targeted
 * Geode SDK / GD version (see mod.json `gd` target). They are referenced here in
 * their conventional form and must be confirmed against the SDK bindings when the
 * mod is built on a configured toolchain. The percent store is reached through
 * GameManager::sharedState() per the design's Geode Hook Strategy.
 */
#include "completion_reader.hpp"

#include <string>
#include <utility>

#include <Geode/Geode.hpp>

using namespace geode::prelude;

namespace tracker {

namespace {

// Best normal-mode percent for a cached level, as an integer 0..100, or nullopt
// when the value is not available. Reading is via the local stats store reached
// through GameManager::sharedState() (Req 1.2; design Phase 1).
std::optional<int> readNormalPercent(GJGameLevel* level) {
    if (level == nullptr) {
        return std::nullopt;
    }
    // GJGameLevel caches the player's best normal-mode percent for the level.
    const int pct = level->m_normalPercent.value();
    return pct;
}

}  // namespace

std::vector<RawCompletion> readLocalCompletions() {
    std::vector<RawCompletion> out;

    // The post-load menu entry guarantees local save data is fully parsed before
    // this runs (hooked at MenuLayer::init, task 8.5). GameManager::sharedState()
    // anchors the local stats; GameLevelManager caches online-level metadata.
    auto* gameManager = GameManager::sharedState();
    auto* levelManager = GameLevelManager::sharedState();
    if (gameManager == nullptr || levelManager == nullptr) {
        return out;
    }

    // Cached online levels carry the level name and id; the stored normal percent
    // is the player's local best for that level. Iterate every cached level and
    // keep the demon-difficulty ones.
    CCDictionary* storedLevels = levelManager->m_onlineLevels;
    if (storedLevels == nullptr) {
        return out;
    }

    // Geode v5 removed the CCDICT_FOREACH macro; iterate via the CCDictionaryExt
    // range-for adapter instead. Keys are the level ids (as strings); values are
    // the cached GJGameLevel objects.
    for (auto [key, object] : CCDictionaryExt<gd::string, GJGameLevel*>(storedLevels)) {
        GJGameLevel* level = object;
        if (level == nullptr) {
            continue;
        }
        // Only demon-difficulty levels are tracked by the tier list.
        if (!level->m_demon) {
            continue;
        }

        RawCompletion raw;
        raw.level_id = std::to_string(level->m_levelID.value());

        // m_levelName is a gd::string; copy into a std::string. A missing/empty
        // name is left empty so filterCompletions() drops it (Req 1.3).
        raw.level_name = std::string(level->m_levelName);

        raw.percentage = readNormalPercent(level);

        out.push_back(std::move(raw));
    }

    return out;
}

}  // namespace tracker
