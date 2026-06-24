/**
 * GD-dependent read of local demon completions (Tracker_Mod) — CROSS-PLATFORM.
 *
 * Returns RAW, unvalidated completions for every locally known demon level. The
 * caller filters/validates them via tracker::filterCompletions() (Req 1.3), and
 * the server keeps only the level_ids present in its demon allow-list (so any
 * non-demon level reported here is harmlessly ignored server-side).
 *
 * Sources are merged (deduped by level id, keeping the highest percent):
 *
 *   1. GameLevelManager::m_onlineLevels  — the cache of downloaded online levels.
 *      Gives the level NAME and the best normal-mode percent, so it is the source
 *      of IN-PROGRESS percentages (and names) for cached levels. Cross-platform,
 *      but only covers levels still in the cache.
 *
 *   2a. (Windows) GameLevelManager::getCompletedLevels(false) — the game's own
 *       list of ALL completed levels, filtered to demons here. Clean and complete,
 *       but only bound for Windows in the current Geode bindings.
 *
 *   2b. (other platforms) GameStatsManager::m_completedLevels — the persistent
 *       dictionary of every completed level, keyed (for online levels) by the
 *       numeric level id. We treat each numeric key as a 100% completion; the
 *       server's allow-list filter drops any that are not demons. This is a plain
 *       struct field, so it is available on every platform.
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

// Adds/updates an entry in the dedup map, keeping the highest percent and the
// best (non-empty) name seen for a given level id.
void addEntry(std::unordered_map<std::string, RawCompletion>& byId,
              const std::string& id,
              const std::string& name,
              int percent) {
    if (id.empty()) {
        return;
    }
    auto it = byId.find(id);
    if (it == byId.end()) {
        RawCompletion raw;
        raw.level_id = id;
        raw.level_name = name;
        raw.percentage = percent;
        byId.emplace(id, std::move(raw));
        return;
    }
    if (!it->second.percentage.has_value() || percent > *it->second.percentage) {
        it->second.percentage = percent;
    }
    if (it->second.level_name.empty() && !name.empty()) {
        it->second.level_name = name;
    }
}

// Folds a GD level (with its own name + percent) into the map, demons only.
void considerLevel(std::unordered_map<std::string, RawCompletion>& byId,
                   GJGameLevel* level,
                   int percent) {
    if (level == nullptr || !level->m_demon) {
        return;
    }
    addEntry(byId, std::to_string(level->m_levelID.value()),
             std::string(level->m_levelName), percent);
}

bool isAllDigits(const std::string& s) {
    if (s.empty()) {
        return false;
    }
    for (const char c : s) {
        if (c < '0' || c > '9') {
            return false;
        }
    }
    return true;
}

}  // namespace

std::vector<RawCompletion> readLocalCompletions() {
    std::vector<RawCompletion> out;

    auto* levelManager = GameLevelManager::sharedState();
    if (levelManager == nullptr) {
        return out;
    }

    std::unordered_map<std::string, RawCompletion> byId;

    // (1) Cached online levels: names + best normal percent (in-progress too).
    if (CCDictionary* storedLevels = levelManager->m_onlineLevels) {
        for (auto [key, object] :
             CCDictionaryExt<gd::string, GJGameLevel*>(storedLevels)) {
            considerLevel(byId, object, object ? object->m_normalPercent.value() : 0);
        }
    }

#ifdef GEODE_IS_WINDOWS
    // (2a) Windows: the full completed-levels list, filtered to demons. 100%.
    if (CCArray* completed = levelManager->getCompletedLevels(false)) {
        for (GJGameLevel* level : CCArrayExt<GJGameLevel*>(completed)) {
            considerLevel(byId, level, 100);
        }
    }
#else
    // (2b) Other platforms: enumerate the persistent completed-levels dictionary.
    // Online-level keys are the numeric level id; treat each as a 100% completion
    // and let the server's allow-list keep only the demons. The name is filled in
    // from the cache when available (the server ignores the uploaded name anyway).
    if (auto* stats = GameStatsManager::sharedState()) {
        if (CCDictionary* completedDict = stats->m_completedLevels) {
            for (auto [key, object] :
                 CCDictionaryExt<gd::string, CCObject*>(completedDict)) {
                const std::string id(key);
                if (isAllDigits(id)) {
                    addEntry(byId, id, id, 100);
                }
            }
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
