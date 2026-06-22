/**
 * Feature: demon-tier-tracker, Property 9: Local completion filtering
 *
 * Property-based test (rapidcheck, >=100 iterations via RC_PARAMS=max_success=100)
 * for the pure local-completion filter in include/tracker/completion_filter.h
 * (task 8.6).
 *
 * Property 9 (design.md): for any collection of raw local completions (mixing
 * valid entries with entries missing a level_id, name, or percentage, or with a
 * percentage outside 0..100), the upload set contains exactly the valid
 * completions (in input order) and the recorded skipped count equals the number
 * of invalid ones.
 *
 * Validates: Requirements 1.3
 *
 * The generator deliberately produces each invalid variant (missing level_id,
 * missing name, missing percentage, percentage < 0, percentage > 100) alongside
 * valid completions so every branch of Requirement 1.3 is exercised. The
 * expectation is computed by an independent oracle (not by reusing
 * filterCompletions) so the test does not merely restate the implementation.
 *
 * Exposed as run_completion_filter_tests() (not a main) so it links into the
 * single tracker_tests executable alongside the other pure-logic tests.
 */
#include <rapidcheck.h>

#include <string>
#include <vector>

#include <tracker/completion_filter.h>

namespace {

using tracker::FilterResult;
using tracker::RawCompletion;
using tracker::ValidCompletion;

// Which kind of raw completion to synthesize. Each invalid variant maps to one
// clause of Requirement 1.3 so the generator covers every rejection branch.
enum class Variant {
    Valid,
    MissingLevelId,    // empty level_id
    MissingName,       // empty level_name
    MissingPercentage, // std::nullopt percentage
    PercentageTooLow,  // percentage < 0
    PercentageTooHigh, // percentage > 100
};

// A non-empty string generator for fields that must be present (level_id / name).
rc::Gen<std::string> nonEmptyString() {
    return rc::gen::suchThat(rc::gen::string<std::string>(),
                             [](const std::string& s) { return !s.empty(); });
}

// Build a RawCompletion of the requested variant.
rc::Gen<RawCompletion> genVariant(Variant v) {
    switch (v) {
        case Variant::Valid:
            return rc::gen::map(
                rc::gen::tuple(nonEmptyString(), nonEmptyString(),
                               rc::gen::inRange(tracker::kMinPercentage,
                                                tracker::kMaxPercentage + 1)),
                [](std::tuple<std::string, std::string, int> t) {
                    return RawCompletion{std::get<0>(t), std::get<1>(t),
                                         std::get<2>(t)};
                });
        case Variant::MissingLevelId:
            return rc::gen::map(
                rc::gen::tuple(nonEmptyString(),
                               rc::gen::inRange(tracker::kMinPercentage,
                                                tracker::kMaxPercentage + 1)),
                [](std::tuple<std::string, int> t) {
                    return RawCompletion{"", std::get<0>(t), std::get<1>(t)};
                });
        case Variant::MissingName:
            return rc::gen::map(
                rc::gen::tuple(nonEmptyString(),
                               rc::gen::inRange(tracker::kMinPercentage,
                                                tracker::kMaxPercentage + 1)),
                [](std::tuple<std::string, int> t) {
                    return RawCompletion{std::get<0>(t), "", std::get<1>(t)};
                });
        case Variant::MissingPercentage:
            return rc::gen::map(
                rc::gen::tuple(nonEmptyString(), nonEmptyString()),
                [](std::tuple<std::string, std::string> t) {
                    return RawCompletion{std::get<0>(t), std::get<1>(t),
                                         std::nullopt};
                });
        case Variant::PercentageTooLow:
            return rc::gen::map(
                rc::gen::tuple(nonEmptyString(), nonEmptyString(),
                               rc::gen::inRange(-1000,
                                                tracker::kMinPercentage)),
                [](std::tuple<std::string, std::string, int> t) {
                    return RawCompletion{std::get<0>(t), std::get<1>(t),
                                         std::get<2>(t)};
                });
        case Variant::PercentageTooHigh:
        default:
            return rc::gen::map(
                rc::gen::tuple(nonEmptyString(), nonEmptyString(),
                               rc::gen::inRange(tracker::kMaxPercentage + 1,
                                                1001)),
                [](std::tuple<std::string, std::string, int> t) {
                    return RawCompletion{std::get<0>(t), std::get<1>(t),
                                         std::get<2>(t)};
                });
    }
}

rc::Gen<RawCompletion> genRawCompletion() {
    return rc::gen::mapcat(
        rc::gen::element(Variant::Valid, Variant::MissingLevelId,
                         Variant::MissingName, Variant::MissingPercentage,
                         Variant::PercentageTooLow, Variant::PercentageTooHigh),
        [](Variant v) { return genVariant(v); });
}

// Independent oracle: a completion is valid iff all fields are present and the
// percentage is within [0, 100]. Deliberately written separately from the
// header's isValidCompletion so the property checks behavior, not identity.
bool oracleValid(const RawCompletion& c) {
    return !c.level_id.empty() && !c.level_name.empty() &&
           c.percentage.has_value() && *c.percentage >= 0 &&
           *c.percentage <= 100;
}

}  // namespace

// Declared in smoke_test.cpp's main(); runs the Property 9 filtering test.
bool run_completion_filter_tests() {
    bool ok = true;

    ok &= rc::check(
        "Property 9: local completion filtering keeps exactly the valid entries "
        "in order and counts the invalid ones",
        [] {
            const auto raw =
                *rc::gen::container<std::vector<RawCompletion>>(genRawCompletion());

            // Independent expectation.
            std::vector<ValidCompletion> expectedValid;
            std::size_t expectedSkipped = 0;
            for (const auto& c : raw) {
                if (oracleValid(c)) {
                    expectedValid.push_back(
                        ValidCompletion{c.level_id, c.level_name, *c.percentage});
                } else {
                    ++expectedSkipped;
                }
            }

            const FilterResult result = tracker::filterCompletions(raw);

            // The upload set is exactly the valid completions, in input order.
            RC_ASSERT(result.valid == expectedValid);
            // The skipped count equals the number of invalid entries.
            RC_ASSERT(result.skipped == expectedSkipped);
            // Conservation: nothing is created or lost.
            RC_ASSERT(result.valid.size() + result.skipped == raw.size());
        });

    return ok;
}
