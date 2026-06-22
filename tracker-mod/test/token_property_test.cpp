/**
 * Property-based coverage for the pure token validator
 * (include/tracker/token.hpp), added in task 8.8.
 *
 * Feature: demon-tier-tracker, Property 13: Whitespace token rejection
 *
 * Property 13 (Validates: Requirements 4.3):
 *   For any string consisting solely of whitespace (or empty), saving it as the
 *   token is rejected and the previously persisted token is retained unchanged.
 *
 * `tracker::is_valid_token` is the pure predicate that drives the
 * reject-and-retain decision: a save is accepted iff the candidate is a valid
 * token. We therefore assert (a) the predicate rejects every empty/whitespace-only
 * string, and (b) a small "retain prior value" model built on that predicate
 * leaves a previously stored valid token unchanged when an invalid save arrives.
 *
 * Exposed as a function (not a `main`) so it links into the single test executable
 * alongside the other pure-logic tests.
 */
#include <rapidcheck.h>

#include <string>
#include <vector>

#include <tracker/token.hpp>

namespace {

/// rapidcheck generator producing strings made up solely of ASCII whitespace
/// (including the empty string). Draws each character from a fixed whitespace
/// alphabet so every generated value is, by construction, empty-or-whitespace.
rc::Gen<std::string> genWhitespaceOnly() {
    static const std::vector<char> kWhitespace = {' ', '\t', '\n', '\r', '\f', '\v'};
    return rc::gen::map(
        rc::gen::container<std::vector<char>>(rc::gen::elementOf(kWhitespace)),
        [](const std::vector<char>& chars) {
            return std::string(chars.begin(), chars.end());
        });
}

/// Minimal pure model of the save logic: a save is applied only when the
/// candidate is a valid token; otherwise the stored value is retained unchanged.
std::string applySave(const std::string& stored, const std::string& candidate) {
    return tracker::is_valid_token(candidate) ? candidate : stored;
}

}  // namespace

bool run_token_property_tests() {
    using namespace tracker;
    bool ok = true;

    // Property 13 (core): any empty/whitespace-only string is rejected by the
    // predicate that gates a save (Req 4.3).
    ok &= rc::check(
        "Property 13: whitespace-only/empty tokens are rejected by is_valid_token",
        [] {
            const std::string ws = *genWhitespaceOnly();
            RC_ASSERT(!is_valid_token(ws));
        });

    // Property 13 (reject-and-retain): given a previously persisted valid token,
    // an invalid (empty/whitespace-only) save leaves the stored token unchanged.
    ok &= rc::check(
        "Property 13: invalid save retains the previously persisted token",
        [] {
            // A prior valid token: 1..256 chars containing at least one
            // non-whitespace character (guaranteed by prefixing a printable char).
            const auto tail = *rc::gen::container<std::string>(
                rc::gen::inRange<char>(33, 127));  // printable, non-whitespace
            std::string prior = "x" + tail;
            if (prior.size() > kMaxTokenLength) {
                prior.resize(kMaxTokenLength);
            }
            RC_PRE(is_valid_token(prior));

            const std::string invalidSave = *genWhitespaceOnly();
            RC_ASSERT(applySave(prior, invalidSave) == prior);
        });

    // Complementary: a string containing at least one non-whitespace character,
    // within the 1..256 length bound, is accepted (Req 4.1 / 4.3).
    ok &= rc::check(
        "Property 13: non-whitespace content within 1..256 is accepted",
        [] {
            const auto len = *rc::gen::inRange<std::size_t>(0, kMaxTokenLength);
            const auto padding = *rc::gen::container<std::string>(
                len, rc::gen::elementOf(std::vector<char>{' ', '\t', 'a', 'Z', '7'}));
            // Guarantee at least one non-whitespace char and stay within bounds.
            std::string token = "q" + padding;
            if (token.size() > kMaxTokenLength) {
                token.resize(kMaxTokenLength);
            }
            RC_ASSERT(is_valid_token(token));
        });

    return ok;
}
