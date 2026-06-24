/**
 * GD-dependent read of local demon completions (Tracker_Mod).
 *
 * Returns RAW, unvalidated completions for every locally known demon level. The
 * caller filters/validates them via tracker::filterCompletions() (Req 1.3).
 *
 * Two sources are merged (deduped by level id, keeping the highest percent):
 *   1. GameLevelManager::m_onlineLevels — the cache of downloaded online levels.
 *      Gives the best normal-mode percent for IN-PROGRESS (and cached completed)
 *      levels. Cross-platform, but only covers levels currently cached.
 *   2. GameLevelManager::getCompletedLevels(false) — the game's own list of ALL
 *      completed levels (not just cached). This is what makes a player's FULL
 *      completed-demon history show up, instead of only the handful still in the
 *      online-level cache. Only bound on Windows in the current Geode bindings,
 *      so it is guarded by GEODE_IS_WINDOWS; other platforms fall back to the
 *      cache scan alone.
 *
 * Requirements: 1.2 (extract Level_ID, level name, Best_Percentage).
 */
#include "completion_reader.hpp"

#include <string>
#include <unordered_map>
#include <utility>

#include <Geode/Geode.hpp>

using namespace geode::prelude;

namespace tracker {

namespace {

// Folds one GD level into the dedup map, keeping the highest percent seen for a
// given level id. Only demon-difficulty levels are tracked by the tier list.
void consider(std::unordered_map<std::string, RawCompletion>& byId,
              GJGameLevel* level,
              int percent) {
    if (level == nullptr || !level->m_demon) {
        return;
    }
    const std::string id = std::to_string(level->m_levelID.value());
    if (id.empty()) {
        return;
    }

    RawCompletion raw;
    raw.level_id = id;
    raw.level_name = std::string(level->m_levelName);  // empty => dropped by filter
    raw.percentage = percent;

    auto it = byId.find(id);
    if (it == byId.end()) {
        byId.emplace(id, std::move(raw));
        return;
    }
    // Keep the higher percent; prefer a non-empty name if we have one now.
    if (!it->second.percentage.has_value() ||
        (raw.percentage.has_value() && *raw.percentage > *it->second.percentage)) {
        it->second.percentage = raw.percentage;
    }
    if (it->second.level_name.empty() && !raw.level_name.empty()) {
        it->second.level_name = raw.level_name;
    }
}

}  // namespace

std::vector<RawCompletion> readLocalCompletions() {
    std::vector<RawCompletion> out;

    auto* levelManager = GameLevelManager::sharedState();
    if (levelManager == nullptr) {
        return out;
    }

    std::unordered_map<std::string, RawCompletion> byId;

    // (1) Cross-platform: cached online levels carry name + best normal percent.
    if (CCDictionary* storedLevels = levelManager->m_onlineLevels) {
        for (auto [key, object] :
             CCDictionaryExt<gd::string, GJGameLevel*>(storedLevels)) {
            GJGameLevel* level = object;
            if (level == nullptr) {
                continue;
            }
            consider(byId, level, level->m_normalPercent.value());
        }
    }

    // (2) Windows: the full list of completed levels (not limited to the cache),
    //     so a player's entire completed-demon history is reported. These are
    //     100% completions by definition.
#ifdef GEODE_IS_WINDOWS
    if (CCArray* completed = levelManager->getCompletedLevels(false)) {
        for (GJGameLevel* level : CCArrayExt<GJGameLevel*>(completed)) {
            consider(byId, level, 100);
        }
    }
#endif

    out.reserve(byId.size());
    for (auto& [id, raw] : byId) {
        out.push_back(std::move(raw));
    }
    return out;
}

}  // namespace tracker
