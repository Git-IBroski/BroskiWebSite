/**
 * Property-based coverage for the pure higher-only live-gating logic
 * (include/tracker/gating.h), added in task 10.5.
 *
 * Feature: demon-tier-tracker, Property 11: Higher-only live gating
 *
 * Property 11 (Validates: Requirements 2.2, 2.3, 2.4):
 *   For any last-reported value (including "none") and any new observed
 *   percentage, the Tracker_Mod emits a submission for that level if and only if
 *   the new percentage is strictly greater than the last-reported value (with
 *   "none" treated as lower than any value).
 *
 * We exercise the pure decision function `tracker::shouldEmit` against a randomly
 * generated `LastReportedMap` (some levels present with random percentages, some
 * absent) and a random observed (levelId, newPercentage). The level under test is
 * drawn so that it is sometimes already present in the map and sometimes absent,
 * covering both the "none" and "has prior value" branches.
 *
 * Exposed as a function (not a `main`) so it links into the single test
 * executable alongside the other pure-logic tests.
 */
#include <rapidcheck.h>

#include <algorithm>
#include <optional>
#include <string>
#include <vector>

#include <tracker/gating.h>

namespace {

/// rapidcheck generator for a percentage in the live-tracking range [0, 100].
rc::Gen<int> genPercentage() {
    return rc::gen::inRange<int>(0, 101);  // inRange upper bound is exclusive
}

/// rapidcheck generator for a level id drawn from a small fixed pool, so that a
/// randomly generated map and a separately generated level id collide often
/// enough to exercise both the "prior value present" and "none" branches.
rc::Gen<std::string> genLevelId() {
    static const std::vector<std::string> kLevels = {
        "128", "44622744", "9876543", "1", "2", "3", "55", "900", "1234567"};
    return rc::gen::elementOf(kLevels);
}

/// rapidcheck generator for a LastReportedMap: a (possibly empty) collection of
/// (levelId -> percentage) entries. Some levels are present, some absent.
rc::Gen<tracker::LastReportedMap> genLastReportedMap() {
    return rc::gen::map(
        rc::gen::container<std::vector<std::pair<std::string, int>>>(
            rc::gen::pair(genLevelId(), genPercentage())),
        [](const std::vector<std::pair<std::string, int>>& entries) {
            tracker::LastReportedMap reported;
            for (const auto& [levelId, pct] : entries) {
                reported[levelId] = pct;
            }
            return reported;
        });
}

}  // namespace

bool run_gating_property_tests() {
    using namespace tracker;
    bool ok = true;

    // Property 11 (core): shouldEmit returns true iff there is no prior entry,
    // or the new percentage is strictly greater than the prior one (Req 2.2-2.4).
    ok &= rc::check(
        "Property 11: shouldEmit iff strictly greater than last-reported (none < any)",
        [] {
            const LastReportedMap reported = *genLastReportedMap();
            const std::string levelId = *genLevelId();
            const int newPercentage = *genPercentage();

            const std::optional<int> prior = lastReported(reported, levelId);
            const bool expected =
                !prior.has_value() ? true : (newPercentage > *prior);

            RC_ASSERT(shouldEmit(reported, levelId, newPercentage) == expected);
        });

    // Property 11 (record-then-withhold): after an emission is recorded, emitting
    // the same value again is withheld, since it is no longer strictly greater
    // (Req 2.4). recordEmission stores the max, so the map reflects the highest
    // reported value.
    ok &= rc::check(
        "Property 11: after recordEmission, the same value no longer emits",
        [] {
            LastReportedMap reported = *genLastReportedMap();
            const std::string levelId = *genLevelId();
            const int newPercentage = *genPercentage();

            // Only meaningful when the value would have emitted in the first place.
            RC_PRE(shouldEmit(reported, levelId, newPercentage));

            recordEmission(reported, levelId, newPercentage);

            // The recorded value is now the last-reported value for the level.
            const std::optional<int> stored = lastReported(reported, levelId);
            RC_ASSERT(stored.has_value());
            RC_ASSERT(*stored == newPercentage);

            // Re-emitting the same value is withheld (not strictly greater).
            RC_ASSERT(!shouldEmit(reported, levelId, newPercentage));
        });

    // Property 11 (record keeps the max): recordEmission never lowers the stored
    // last-reported value; it stores max(prior, newPercentage).
    ok &= rc::check(
        "Property 11: recordEmission updates the map to the max",
        [] {
            LastReportedMap reported = *genLastReportedMap();
            const std::string levelId = *genLevelId();
            const int newPercentage = *genPercentage();

            const std::optional<int> prior = lastReported(reported, levelId);
            recordEmission(reported, levelId, newPercentage);

            const std::optional<int> stored = lastReported(reported, levelId);
            RC_ASSERT(stored.has_value());
            const int expectedMax =
                prior.has_value() ? std::max(*prior, newPercentage) : newPercentage;
            RC_ASSERT(*stored == expectedMax);
        });

    return ok;
}
