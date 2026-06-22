/**
 * Demon Tier Tracker - Geode mod entry point.
 *
 * This file contains the conventional Geode boilerplate and the `MenuLayer::init`
 * hook that triggers Initial_Sync. The hook body is deliberately O(1) on the main
 * thread: it simply forwards to `tracker::runInitialSync()`, which performs a
 * cheap session-guard + token check on the main thread and dispatches the local
 * read, batching, and background POSTs off-thread (see src/initial_sync.cpp).
 *
 * Requirements: 1.1 (Initial Sync triggers from the post-load menu entry),
 *               3.1 (only a cheap "should I sync?" flag check touches the main
 *               thread; all real work is dispatched off-thread).
 */
#include <Geode/Geode.hpp>
#include <Geode/modify/MenuLayer.hpp>

#include "initial_sync.hpp"
#include "token_setting.hpp"

using namespace geode::prelude;

// Hook the post-load menu entry. MenuLayer::init is the first reliable point at
// which local save data is fully parsed (see design: Geode Hook Strategy, Phase 1).
class $modify(TrackerMenuLayer, MenuLayer) {
    bool init() {
        if (!MenuLayer::init()) {
            return false;
        }

        // On the first invocation per session, kick off Initial_Sync if a token
        // is configured and the sync flag is unset. This call is O(1) on the main
        // thread; the read of local completions and the network POSTs run on
        // background threads (Req 1.1, 3.1). Subsequent re-inits are no-ops.
        tracker::runInitialSync();

        return true;
    }
};

// Runs once when the mod is loaded.
$execute {
    log::info("Demon Tier Tracker mod loaded (v0.1.0).");

    // Enforce token validation on every settings save (Req 4.3). Persistence of the
    // declared `player-token` setting is handled automatically by Geode (Req 4.2).
    tracker::registerTokenSettingValidation();
}
