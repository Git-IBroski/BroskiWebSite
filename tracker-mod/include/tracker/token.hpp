/**
 * Tracker_Mod — pure token validation logic.
 *
 * This header is intentionally **Geode-SDK-independent**: it depends only on the
 * C++ standard library so it can be unit- and property-tested on any machine with
 * a C++20 toolchain (no GD headers, no Geode SDK). The Geode-dependent wiring that
 * connects this logic to the actual `player-token` setting lives in `src/`.
 *
 * Requirements:
 *   4.1 — the Secret_Player_Token is a string of 1..256 characters.
 *   4.3 — a save that is empty or whitespace-only is rejected (and the previously
 *         persisted token is retained); this header provides the pure predicate
 *         used to make that decision.
 *
 * Property 13 (task 8.8) property-tests `is_valid_token` against whitespace-only
 * and empty strings.
 */
#pragma once

#include <cctype>
#include <string>
#include <string_view>

namespace tracker {

/// Inclusive lower bound on a valid token's length (Req 4.1).
inline constexpr std::size_t kMinTokenLength = 1;

/// Inclusive upper bound on a valid token's length (Req 4.1).
inline constexpr std::size_t kMaxTokenLength = 256;

/// True if `c` is an ASCII whitespace character.
///
/// Cast to `unsigned char` first: passing a negative `char` to `std::isspace`
/// is undefined behavior.
inline bool is_whitespace(char c) noexcept {
    return std::isspace(static_cast<unsigned char>(c)) != 0;
}

/// True if `s` is empty or consists solely of whitespace characters.
inline bool is_blank(std::string_view s) noexcept {
    for (char c : s) {
        if (!is_whitespace(c)) {
            return false;
        }
    }
    return true;
}

/// Returns `s` with leading and trailing whitespace removed.
inline std::string trim(std::string_view s) {
    std::size_t begin = 0;
    std::size_t end = s.size();
    while (begin < end && is_whitespace(s[begin])) {
        ++begin;
    }
    while (end > begin && is_whitespace(s[end - 1])) {
        --end;
    }
    return std::string(s.substr(begin, end - begin));
}

/// Validation predicate for a Secret_Player_Token.
///
/// A token is valid iff it is **non-empty after trimming whitespace** (rejecting
/// empty and whitespace-only saves, Req 4.3) **and** its length is within the
/// 1..256 inclusive bound (Req 4.1).
///
/// The length bound is checked against the raw token as entered (the value that
/// would be persisted), not the trimmed value.
inline bool is_valid_token(std::string_view token) noexcept {
    if (token.size() < kMinTokenLength || token.size() > kMaxTokenLength) {
        return false;
    }
    return !is_blank(token);
}

}  // namespace tracker
