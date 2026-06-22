/**
 * Tracker_Mod — Geode-dependent token setting wiring (implementation).
 *
 * Geode persists the value of any declared setting across launches automatically
 * (Req 4.2), so this file does not implement persistence itself. Its job is to
 * gate *saves* through the pure validator and, when a save is invalid, restore the
 * previously persisted value and surface a user-facing notice (Req 4.3).
 *
 * Strategy:
 *   - Track the last value we accepted as valid (`s_lastValidToken`), seeded from
 *     the persisted setting at load time.
 *   - On every setting change, validate the new value with `tracker::is_valid_token`.
 *       * valid   → remember it as the new "last valid" value.
 *       * invalid → restore `s_lastValidToken` into the setting and show a notice,
 *                   so the previously persisted token is retained unchanged.
 *
 * This file is Geode-dependent (uses `Mod`, `Notification`, `listenForSettingChanges`)
 * and so cannot be compiled without the Geode SDK. The validation rule itself is the
 * pure `tracker::is_valid_token` in include/tracker/token.hpp, which is fully testable
 * without the SDK.
 */
#include "token_setting.hpp"

#include <Geode/Geode.hpp>

#include <tracker/token.hpp>

using namespace geode::prelude;

namespace tracker {

namespace {

// The last value accepted as valid. This is the value restored when a subsequent
// save is rejected (Req 4.3). An empty string means "no valid token configured".
std::string s_lastValidToken;

// Guards against re-entrancy: when we programmatically restore the prior value via
// setSettingValue, that itself fires the change callback; we must not treat that
// restoration as a new user save.
bool s_restoring = false;

}  // namespace

void registerTokenSettingValidation() {
    // Seed the "last valid" value from whatever Geode has already persisted. If the
    // persisted value somehow fails validation (e.g. a hand-edited save file), treat
    // it as "no valid token" rather than trusting it.
    const std::string persisted =
        Mod::get()->getSettingValue<std::string>(kTokenSettingKey);
    s_lastValidToken = is_valid_token(persisted) ? persisted : std::string{};

    listenForSettingChanges<std::string>(
        kTokenSettingKey, [](std::string value) {
            if (s_restoring) {
                // This change was triggered by our own restore call below; ignore it.
                return;
            }

            if (is_valid_token(value)) {
                // Accept and remember. Geode has already persisted it (Req 4.2).
                s_lastValidToken = value;
                return;
            }

            // Reject the empty/whitespace-only (or out-of-range) save: restore the
            // previously persisted token and notify the player (Req 4.3).
            s_restoring = true;
            Mod::get()->setSettingValue<std::string>(kTokenSettingKey, s_lastValidToken);
            s_restoring = false;

            Notification::create(
                "Secret Player Token: a non-empty token (1-256 characters) is "
                "required. Your previous token was kept.",
                NotificationIcon::Error)
                ->show();

            log::warn(
                "Demon Tier Tracker: rejected invalid token save; retained prior value.");
        });
}

std::optional<std::string> getConfiguredToken() {
    const std::string current =
        Mod::get()->getSettingValue<std::string>(kTokenSettingKey);
    if (is_valid_token(current)) {
        return current;
    }
    return std::nullopt;
}

}  // namespace tracker
