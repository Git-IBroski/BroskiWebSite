#pragma once

/**
 * Tracker_Mod — diagnostic logging helper.
 *
 * `tracker::diag(...)` formats a message once and sends it BOTH to Geode's log
 * (so it lands in the on-disk log file) AND to the in-memory diagnostic buffer
 * (so the in-game "DTT" popup can show it live, without waiting for the log file
 * to flush). Use it for the Initial_Sync breadcrumbs that we want a tester to be
 * able to read in-game.
 *
 * Geode-dependent (uses geode::log + bundled fmt); only included from .cpp files
 * that already pull in the Geode SDK.
 */
#include <string>
#include <utility>

#include <Geode/Geode.hpp>

#include "diag_log.hpp"

namespace tracker {

template <typename... Args>
inline void diag(fmt::format_string<Args...> fmtStr, Args&&... args) {
    std::string msg = fmt::format(fmtStr, std::forward<Args>(args)...);
    geode::log::info("Demon Tier Tracker: {}", msg);
    diagAdd(msg);
}

}  // namespace tracker
