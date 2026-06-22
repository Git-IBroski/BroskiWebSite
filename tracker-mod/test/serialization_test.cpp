/**
 * Feature: demon-tier-tracker, Property 10: Completion serialization round-trip
 *
 * Property-based test (rapidcheck, >=100 iterations via RC_PARAMS=max_success=100)
 * for the pure JSON serialization/parsing in include/tracker/serialization.h
 * (task 8.7).
 *
 * Property 10 (design.md): for any list of valid completions (including the
 * empty list), serializing the list to the JSON array and parsing it back
 * yields an equivalent list of completions, i.e.
 *
 *   parseCompletions(serializeCompletions(xs)) == xs   for all valid xs.
 *
 * Validates: Requirements 1.4
 *
 * The generator deliberately produces level_id / level_name strings containing
 * tricky bytes -- double quotes, backslashes, control characters (newline,
 * carriage return, tab), and multi-byte UTF-8 (Unicode) sequences -- so the
 * escaping/unescaping path is exercised, not just plain ASCII. Percentages are
 * drawn from the valid inclusive range 0..100. The empty list is covered both by
 * rapidcheck's container shrinking toward [] and by an explicit assertion below.
 *
 * Exposed as run_serialization_tests() (not a main) so it links into the single
 * tracker_tests executable alongside the other pure-logic tests.
 */
#include <rapidcheck.h>

#include <optional>
#include <string>
#include <vector>

#include <tracker/serialization.h>

namespace {

using tracker::ValidCompletion;
using tracker::parseCompletions;
using tracker::serializeCompletions;

// A "tricky" character generator: a mix of ordinary ASCII plus the bytes whose
// handling matters for JSON escaping. Returning bytes >= 0x80 lets the generator
// assemble multi-byte UTF-8 sequences, exercising the verbatim high-byte path.
rc::Gen<char> trickyChar() {
    return rc::gen::oneOf(
        // Ordinary printable ASCII letters/digits.
        rc::gen::map(rc::gen::inRange<int>('a', 'z' + 1),
                     [](int c) { return static_cast<char>(c); }),
        rc::gen::map(rc::gen::inRange<int>('0', '9' + 1),
                     [](int c) { return static_cast<char>(c); }),
        // The characters that must be escaped or are otherwise special.
        rc::gen::element<char>('"', '\\', '/', '\n', '\r', '\t', '\b', '\f',
                               ' ', '{', '}', '[', ']', ':', ','),
        // A couple of low control characters that take the \u00XX path.
        rc::gen::element<char>('\x01', '\x1f'),
        // High bytes (>= 0x80): UTF-8 continuation/lead bytes, emitted verbatim
        // so the exact byte content must round-trip.
        rc::gen::map(rc::gen::inRange<int>(0x80, 0x100),
                     [](int c) { return static_cast<char>(c); }));
}

// A non-empty string built from tricky characters (Req 1.3: level_id and
// level_name are always non-empty for a ValidCompletion).
rc::Gen<std::string> nonEmptyTrickyString() {
    return rc::gen::map(
        rc::gen::nonEmpty(rc::gen::container<std::string>(trickyChar())),
        [](std::string s) { return s; });
}

rc::Gen<ValidCompletion> genValidCompletion() {
    return rc::gen::map(
        rc::gen::tuple(nonEmptyTrickyString(), nonEmptyTrickyString(),
                       rc::gen::inRange(tracker::kMinPercentage,
                                        tracker::kMaxPercentage + 1)),
        [](std::tuple<std::string, std::string, int> t) {
            return ValidCompletion{std::get<0>(t), std::get<1>(t),
                                   std::get<2>(t)};
        });
}

}  // namespace

// Declared in smoke_test.cpp's main(); runs the Property 10 round-trip test.
bool run_serialization_tests() {
    bool ok = true;

    // Explicit empty-list case: "[]" must parse back to an empty list.
    {
        const std::vector<ValidCompletion> empty;
        const std::string json = serializeCompletions(empty);
        if (json != "[]") {
            return false;
        }
        const auto parsed = parseCompletions(json);
        if (!parsed.has_value() || !parsed->empty()) {
            return false;
        }
    }

    ok &= rc::check(
        "Property 10: completion serialization round-trip "
        "(parseCompletions(serializeCompletions(xs)) == xs)",
        [] {
            const auto xs = *rc::gen::container<std::vector<ValidCompletion>>(
                genValidCompletion());

            const std::string json = serializeCompletions(xs);
            const std::optional<std::vector<ValidCompletion>> parsed =
                parseCompletions(json);

            // The serialized array must always parse cleanly...
            RC_ASSERT(parsed.has_value());
            // ...and reproduce exactly the original list of completions.
            RC_ASSERT(*parsed == xs);
        });

    return ok;
}
