/**
 * Tracker_Mod — Geode-dependent token setting wiring (declarations).
 *
 * Connects the pure `tracker::is_valid_token` predicate (include/tracker/token.hpp)
 * to the Geode `player-token` string setting declared in mod.json. This header is
 * Geode-dependent and therefore lives in `src/`, not in `include/tracker/`.
 *
 * Requirements: 4.1, 4.2 (persistence is handled by Geode for declared settings),
 *               4.3 (reject empty/whitespace saves, retain prior value, notify).
 */
#pragma once

#include <optional>
#include <string>

namespace tracker {

/// Setting key for the Secret_Player_Token, as declared in mod.json.
inline constexpr const char* kTokenSettingKey = "player-token";

/// Registers the settings-changed callback that enforces token validation
/// (Req 4.3). Call once during mod load (see `$execute` in main.cpp).
void registerTokenSettingValidation();

/// Returns the currently configured, valid Secret_Player_Token, or `std::nullopt`
/// if no valid token is configured. Used by the networking layer to decide whether
/// uploads can be attributed (Req 4.4, 4.5) and as the source of the "prior valid
/// value" restored on a rejected save (Req 4.3).
std::optional<std::string> getConfiguredToken();

}  // namespace tracker
