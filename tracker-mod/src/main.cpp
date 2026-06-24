/**
 * Demon Tier Tracker - Geode mod entry point.
 *
 * Contains the Geode boilerplate, the `MenuLayer::init` hook that triggers
 * Initial_Sync, and a small "DTT" button added to the main menu that opens an
 * in-game console-style popup of the mod's diagnostic buffer (see diag_log.*).
 * The popup lets a tester read exactly what the mod did WITHOUT digging through
 * Geode's on-disk log file (whose tail can lag while the game is running).
 *
 * Requirements: 1.1 (Initial Sync triggers from the post-load menu entry),
 *               3.1 (only a cheap check touches the main thread; real work runs
 *               off-thread).
 */
#include <string>
#include <vector>

#include <Geode/Geode.hpp>
#include <Geode/modify/MenuLayer.hpp>

#include "diag.hpp"
#include "diag_log.hpp"
#include "initial_sync.hpp"
#include "token_setting.hpp"

using namespace geode::prelude;

namespace {

// Builds the joined diagnostic text (most recent lines last) for the popup.
std::string buildDiagText() {
    const std::vector<std::string> lines = tracker::diagSnapshot();
    if (lines.empty()) {
        return "(no Demon Tier Tracker activity recorded yet)";
    }
    // Show the most recent ~22 lines so the alert stays readable.
    std::size_t start = lines.size() > 22 ? lines.size() - 22 : 0;
    std::string text;
    for (std::size_t i = start; i < lines.size(); ++i) {
        text += lines[i];
        text += "\n";
    }
    return text;
}

}  // namespace

// Hook the post-load menu entry. MenuLayer::init is the first reliable point at
// which local save data is fully parsed (see design: Geode Hook Strategy).
class $modify(TrackerMenuLayer, MenuLayer) {
    // Run our MenuLayer::init hook FIRST, before other mods' hooks. Some menu
    // mods (background customizers, joke mods, etc.) hook MenuLayer::init and can
    // break the hook chain; forcing high priority ensures our body still runs so
    // the Initial_Sync, the on-screen notification, and the "DTT" button always
    // appear regardless of what else is installed.
    static void onModify(auto& self) {
        (void)self.setHookPriority("MenuLayer::init", Priority::First);
    }

    bool init() {
        if (!MenuLayer::init()) {
            return false;
        }

        // Unconditional breadcrumb: proves the MenuLayer::init hook actually runs
        // on the player's setup (some menu-modifying mods can short-circuit the
        // hook chain). If this line is absent, our hook never fired.
        tracker::diag("MenuLayer::init hook reached; calling runInitialSync().");

        // First invocation per session kicks off Initial_Sync (O(1) on the main
        // thread; the read + POSTs run on background threads). Re-inits are no-ops.
        tracker::runInitialSync();

        // Add a small "DTT" button to the menu that opens the diagnostics popup.
        this->addDiagButton();

        return true;
    }

    // Adds a top-right info button wired to onDtt(). Guarded so repeated
    // MenuLayer::init calls don't stack duplicate buttons.
    void addDiagButton() {
        if (this->getChildByID("dtt-diag-menu") != nullptr) {
            return;
        }
        const auto winSize = CCDirector::sharedDirector()->getWinSize();

        auto* icon = CCSprite::createWithSpriteFrameName("GJ_infoIcon_001.png");
        if (icon == nullptr) {
            return;  // sprite frame missing for some reason; skip the button
        }
        icon->setScale(0.8f);

        auto* btn = CCMenuItemSpriteExtra::create(
            icon, this, menu_selector(TrackerMenuLayer::onDtt));

        auto* menu = CCMenu::create();
        menu->setID("dtt-diag-menu");
        menu->addChild(btn);
        menu->setPosition(winSize.width - 28.f, winSize.height - 28.f);
        this->addChild(menu, 1000);
    }

    void onDtt(CCObject*) {
        FLAlertLayer::create("Demon Tier Tracker", buildDiagText(), "OK")->show();
    }
};

// Runs once when the mod is loaded.
$execute {
    log::info("Demon Tier Tracker mod loaded (v0.2.0).");
    tracker::diagAdd("mod loaded (v0.2.0).");

    // Enforce token validation on every settings save (Req 4.3). Persistence of
    // the declared `player-token` setting is handled automatically by Geode.
    tracker::registerTokenSettingValidation();
}
