/**
 * Property-based coverage for the pure persisted retry queue
 * (include/tracker/retry_queue.h), added in task 10.6.
 *
 * Feature: demon-tier-tracker, Property 12: Retry queue keeps one highest entry per level
 *
 * Property 12 (Validates: Requirements 2.7, 2.8):
 *   For any sequence of enqueue operations followed by confirmations, the retry
 *   queue contains at most one entry per level_id, each entry's percentage equals
 *   the maximum percentage enqueued for that level since its last confirmation,
 *   and confirmed level_ids are absent from the queue.
 *
 * We drive a random sequence of operations (enqueue {level_id, name, percentage}
 * | confirm level_id) against a real RetryQueue while maintaining an independent
 * oracle model: a map level_id -> max-percentage-since-last-confirm where confirm
 * removes the key. After the sequence we assert the queue matches the oracle, and
 * that a toJson()->fromJson() round-trip preserves the queue contents.
 *
 * Exposed as a function (not a `main`) so it links into the single test
 * executable alongside the other pure-logic tests.
 */
#include <rapidcheck.h>

#include <map>
#include <optional>
#include <string>
#include <vector>

#include <tracker/retry_queue.h>

namespace {

using tracker::Record;
using tracker::RetryQueue;

/// rapidcheck generator for a percentage in the live-tracking range [0, 100].
rc::Gen<int> genPercentage() {
    return rc::gen::inRange<int>(0, 101);  // inRange upper bound is exclusive
}

/// Small fixed pool of level ids so that enqueues and confirms collide often,
/// exercising replacement (highest wins) and removal-then-reinsertion branches.
rc::Gen<std::string> genLevelId() {
    static const std::vector<std::string> kLevels = {
        "128", "44622744", "9876543", "1", "2", "3"};
    return rc::gen::elementOf(kLevels);
}

/// A single operation applied to both the queue and the oracle.
struct Op {
    bool isConfirm = false;   // true => confirm(level_id); false => enqueue(...)
    std::string level_id;
    std::string level_name;
    int percentage = 0;
};

rc::Gen<Op> genOp() {
    return rc::gen::mapcat(rc::gen::arbitrary<bool>(), [](bool isConfirm) {
        if (isConfirm) {
            return rc::gen::map(genLevelId(), [](std::string id) {
                Op op;
                op.isConfirm = true;
                op.level_id = std::move(id);
                return op;
            });
        }
        return rc::gen::apply(
            [](std::string id, std::string name, int pct) {
                Op op;
                op.isConfirm = false;
                op.level_id = std::move(id);
                op.level_name = std::move(name);
                op.percentage = pct;
                return op;
            },
            genLevelId(),
            rc::gen::arbitrary<std::string>(),
            genPercentage());
    });
}

}  // namespace

bool run_retry_queue_property_tests() {
    bool ok = true;

    // Property 12: the queue tracks one highest entry per level since the last
    // confirmation, and confirmed level_ids are absent (Req 2.7, 2.8).
    ok &= rc::check(
        "Property 12: retry queue keeps one highest entry per level",
        [] {
            const std::vector<Op> ops = *rc::gen::container<std::vector<Op>>(genOp());

            RetryQueue queue;
            // Oracle: level_id -> max percentage enqueued since its last confirm.
            // Confirm removes the key entirely; an absent key means "not queued".
            std::map<std::string, int> oracle;

            for (const auto& op : ops) {
                if (op.isConfirm) {
                    queue.confirm(op.level_id);
                    oracle.erase(op.level_id);
                } else {
                    queue.enqueue(Record{op.level_id, op.level_name, op.percentage});
                    // enqueue ignores empty level_ids; mirror that in the oracle.
                    if (!op.level_id.empty()) {
                        const auto it = oracle.find(op.level_id);
                        if (it == oracle.end()) {
                            oracle.emplace(op.level_id, op.percentage);
                        } else if (op.percentage > it->second) {
                            it->second = op.percentage;
                        }
                    }
                }
            }

            // At most one entry per level (size matches the oracle's key count).
            RC_ASSERT(queue.size() == oracle.size());

            // Each present level's percentage equals the oracle max.
            for (const auto& [levelId, expectedPct] : oracle) {
                RC_ASSERT(queue.contains(levelId));
                const std::optional<Record> rec = queue.get(levelId);
                RC_ASSERT(rec.has_value());
                RC_ASSERT(rec->percentage == expectedPct);
            }

            // Confirmed / never-enqueued levels (absent from oracle) are absent.
            for (const auto& rec : queue.records()) {
                RC_ASSERT(oracle.find(rec.level_id) != oracle.end());
            }

            // toJson() -> fromJson() round-trip preserves the queue contents.
            const std::string json = queue.toJson();
            const std::optional<RetryQueue> parsed = RetryQueue::fromJson(json);
            RC_ASSERT(parsed.has_value());
            RC_ASSERT(parsed->records() == queue.records());
        });

    return ok;
}
