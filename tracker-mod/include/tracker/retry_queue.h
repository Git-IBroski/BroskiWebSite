#pragma once

/**
 * Persisted retry queue — pure, Geode-independent logic (task 10.2).
 *
 * This header has NO dependency on the Geode SDK or Geometry Dash headers: it
 * depends only on the C++ standard library, so it builds and is property-tested
 * standalone under the -DTRACKER_BUILD_TESTS=ON path (Property 12, task 10.6).
 *
 * The GD-/Geode-dependent persistence wiring (writing this queue's JSON into the
 * Geode Mod save dir and reading it back across launches, and dispatching the
 * actual `web::WebRequest`) lives in `src/`. This header owns ONLY the pure
 * pieces: the in-memory structure, its invariants, and the JSON round-trip used
 * to persist it.
 *
 * Requirements:
 *   2.6 - a Live_Tracking Record whose POST is not confirmed is queued and
 *         persisted across game launches (hence the JSON serialize/parse here).
 *   2.7 - when the Records_API confirms a queued Record, it is removed from the
 *         retry queue.
 *   2.8 - while the queue holds unsent Records it retains at most ONE Record per
 *         Level_ID, replacing any queued Record for that Level_ID with the one
 *         holding the highest Best_Percentage value.
 *
 * To avoid editing other agents' files concurrently, this header defines its own
 * minimal `Record` type and minimal JSON helpers rather than depending on a
 * shared `serialization.h`. The shape mirrors the Records_API payload
 * (`level_id`, `level_name`, `percentage`).
 */

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace tracker {

/**
 * A single queued Record awaiting (re)submission to the Records_API.
 *
 * Mirrors the Live_Tracking payload shape: a non-empty `level_id`, a
 * `level_name` (carried so a requeued record can still bootstrap demon labels),
 * and an integer `percentage` in [0, 100].
 */
struct Record {
    std::string level_id;
    std::string level_name;
    int percentage = 0;
};

inline bool operator==(const Record& a, const Record& b) {
    return a.level_id == b.level_id &&
           a.level_name == b.level_name &&
           a.percentage == b.percentage;
}

inline bool operator!=(const Record& a, const Record& b) {
    return !(a == b);
}

namespace detail {

// --- Minimal JSON string escaping (self-contained, no external deps) --------

/// Appends `s` to `out` as a quoted, escaped JSON string. Control characters
/// (< 0x20) are emitted as `\uXXXX`; `"` and `\` are backslash-escaped. UTF-8
/// bytes >= 0x80 pass through unchanged so multi-byte names round-trip verbatim.
inline void appendJsonString(std::string& out, std::string_view s) {
    static const char* kHex = "0123456789abcdef";
    out.push_back('"');
    for (unsigned char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    out += "\\u00";
                    out.push_back(kHex[(c >> 4) & 0xF]);
                    out.push_back(kHex[c & 0xF]);
                } else {
                    out.push_back(static_cast<char>(c));
                }
        }
    }
    out.push_back('"');
}

// --- Minimal JSON parser (only the array-of-records shape we emit) ----------
//
// Tolerant of insignificant whitespace. Returns std::nullopt on any malformed
// input rather than throwing, so a corrupt save file degrades to "empty queue"
// at the call site instead of crashing the game.

inline void skipWs(std::string_view s, std::size_t& i) {
    while (i < s.size()) {
        const char c = s[i];
        if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
            ++i;
        } else {
            break;
        }
    }
}

/// Encodes a Unicode code point (BMP) as UTF-8 into `out`.
inline void appendUtf8(std::string& out, std::uint32_t cp) {
    if (cp <= 0x7F) {
        out.push_back(static_cast<char>(cp));
    } else if (cp <= 0x7FF) {
        out.push_back(static_cast<char>(0xC0 | (cp >> 6)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    } else {
        out.push_back(static_cast<char>(0xE0 | (cp >> 12)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    }
}

inline std::optional<int> parseHex4(std::string_view s, std::size_t& i) {
    if (i + 4 > s.size()) {
        return std::nullopt;
    }
    std::uint32_t value = 0;
    for (int k = 0; k < 4; ++k) {
        const char c = s[i + static_cast<std::size_t>(k)];
        value <<= 4;
        if (c >= '0' && c <= '9') {
            value |= static_cast<std::uint32_t>(c - '0');
        } else if (c >= 'a' && c <= 'f') {
            value |= static_cast<std::uint32_t>(c - 'a' + 10);
        } else if (c >= 'A' && c <= 'F') {
            value |= static_cast<std::uint32_t>(c - 'A' + 10);
        } else {
            return std::nullopt;
        }
    }
    i += 4;
    return static_cast<int>(value);
}

/// Parses a JSON string starting at `s[i]` (which must be the opening quote).
inline std::optional<std::string> parseString(std::string_view s, std::size_t& i) {
    if (i >= s.size() || s[i] != '"') {
        return std::nullopt;
    }
    ++i;  // consume opening quote
    std::string out;
    while (i < s.size()) {
        const char c = s[i++];
        if (c == '"') {
            return out;
        }
        if (c == '\\') {
            if (i >= s.size()) {
                return std::nullopt;
            }
            const char esc = s[i++];
            switch (esc) {
                case '"':  out.push_back('"'); break;
                case '\\': out.push_back('\\'); break;
                case '/':  out.push_back('/'); break;
                case 'b':  out.push_back('\b'); break;
                case 'f':  out.push_back('\f'); break;
                case 'n':  out.push_back('\n'); break;
                case 'r':  out.push_back('\r'); break;
                case 't':  out.push_back('\t'); break;
                case 'u': {
                    const auto cp = parseHex4(s, i);
                    if (!cp.has_value()) {
                        return std::nullopt;
                    }
                    appendUtf8(out, static_cast<std::uint32_t>(*cp));
                    break;
                }
                default:
                    return std::nullopt;
            }
        } else {
            out.push_back(c);
        }
    }
    return std::nullopt;  // unterminated string
}

/// Parses a (possibly negative) JSON integer.
inline std::optional<int> parseInt(std::string_view s, std::size_t& i) {
    const std::size_t start = i;
    if (i < s.size() && (s[i] == '-' || s[i] == '+')) {
        ++i;
    }
    std::size_t digits = 0;
    while (i < s.size() && s[i] >= '0' && s[i] <= '9') {
        ++i;
        ++digits;
    }
    if (digits == 0) {
        return std::nullopt;
    }
    try {
        return std::stoi(std::string(s.substr(start, i - start)));
    } catch (...) {
        return std::nullopt;
    }
}

}  // namespace detail

/**
 * The persisted retry queue (Req 2.6, 2.7, 2.8).
 *
 * Backed by an ordered `std::map<level_id, Record>` so that:
 *   - there is structurally AT MOST ONE entry per level_id (Req 2.8), and
 *   - serialization is deterministic (entries emitted in level_id order), which
 *     keeps the persisted JSON stable across launches.
 */
class RetryQueue {
public:
    /**
     * Enqueues `record` for (re)submission (Req 2.8).
     *
     * If no entry exists for `record.level_id`, it is inserted. If an entry
     * already exists, it is REPLACED only when `record.percentage` is strictly
     * greater than the queued percentage; otherwise the queued (higher-or-equal)
     * entry is retained unchanged. Records with an empty `level_id` are ignored.
     *
     * @return true if the queue was modified (inserted or replaced).
     */
    bool enqueue(const Record& record) {
        if (record.level_id.empty()) {
            return false;
        }
        const auto it = entries_.find(record.level_id);
        if (it == entries_.end()) {
            entries_.emplace(record.level_id, record);
            return true;
        }
        if (record.percentage > it->second.percentage) {
            it->second = record;
            return true;
        }
        return false;
    }

    /**
     * Removes the queued Record for `levelId` on confirmation (Req 2.7).
     *
     * @return true if an entry was present and removed.
     */
    bool confirm(const std::string& levelId) {
        return entries_.erase(levelId) > 0;
    }

    /// True if the queue currently holds an entry for `levelId`.
    bool contains(const std::string& levelId) const {
        return entries_.find(levelId) != entries_.end();
    }

    /// Returns the queued Record for `levelId`, or std::nullopt if absent.
    std::optional<Record> get(const std::string& levelId) const {
        const auto it = entries_.find(levelId);
        if (it == entries_.end()) {
            return std::nullopt;
        }
        return it->second;
    }

    /// Number of queued Records.
    std::size_t size() const { return entries_.size(); }

    /// True if the queue holds no Records.
    bool empty() const { return entries_.empty(); }

    /// All queued Records, in level_id order (matches serialization order).
    std::vector<Record> records() const {
        std::vector<Record> out;
        out.reserve(entries_.size());
        for (const auto& [id, rec] : entries_) {
            out.push_back(rec);
        }
        return out;
    }

    /**
     * Serializes the queue to a JSON array of records (Req 2.6).
     *
     * Shape: `[{"level_id":"...","level_name":"...","percentage":N}, ...]`.
     * An empty queue serializes to `[]`. The result is suitable for writing into
     * the Geode mod save dir; `fromJson` is its inverse.
     */
    std::string toJson() const {
        std::string out;
        out.push_back('[');
        bool first = true;
        for (const auto& [id, rec] : entries_) {
            if (!first) {
                out.push_back(',');
            }
            first = false;
            out += "{\"level_id\":";
            detail::appendJsonString(out, rec.level_id);
            out += ",\"level_name\":";
            detail::appendJsonString(out, rec.level_name);
            out += ",\"percentage\":";
            out += std::to_string(rec.percentage);
            out.push_back('}');
        }
        out.push_back(']');
        return out;
    }

    /**
     * Parses a queue previously produced by `toJson` (Req 2.6).
     *
     * Returns std::nullopt on malformed input so a corrupted save file can be
     * treated as "start with an empty queue" rather than crashing. The enqueue
     * invariant (one highest entry per level_id) is re-applied while parsing, so
     * a hand-edited file with duplicate level_ids still yields a valid queue.
     */
    static std::optional<RetryQueue> fromJson(std::string_view json) {
        RetryQueue queue;
        std::size_t i = 0;
        detail::skipWs(json, i);
        if (i >= json.size() || json[i] != '[') {
            return std::nullopt;
        }
        ++i;  // consume '['
        detail::skipWs(json, i);
        if (i < json.size() && json[i] == ']') {
            ++i;  // empty array
            detail::skipWs(json, i);
            return i == json.size() ? std::optional<RetryQueue>(queue) : std::nullopt;
        }
        while (true) {
            detail::skipWs(json, i);
            auto record = parseRecord(json, i);
            if (!record.has_value()) {
                return std::nullopt;
            }
            queue.enqueue(*record);
            detail::skipWs(json, i);
            if (i >= json.size()) {
                return std::nullopt;
            }
            if (json[i] == ',') {
                ++i;
                continue;
            }
            if (json[i] == ']') {
                ++i;
                break;
            }
            return std::nullopt;
        }
        detail::skipWs(json, i);
        return i == json.size() ? std::optional<RetryQueue>(queue) : std::nullopt;
    }

private:
    std::map<std::string, Record> entries_;

    /// Parses a single `{"level_id":..,"level_name":..,"percentage":..}` object.
    /// Key order is fixed to the order `toJson` emits, keeping the parser minimal.
    static std::optional<Record> parseRecord(std::string_view s, std::size_t& i) {
        detail::skipWs(s, i);
        if (i >= s.size() || s[i] != '{') {
            return std::nullopt;
        }
        ++i;  // consume '{'

        Record rec;
        bool haveId = false;
        bool haveName = false;
        bool havePct = false;

        while (true) {
            detail::skipWs(s, i);
            const auto key = detail::parseString(s, i);
            if (!key.has_value()) {
                return std::nullopt;
            }
            detail::skipWs(s, i);
            if (i >= s.size() || s[i] != ':') {
                return std::nullopt;
            }
            ++i;  // consume ':'
            detail::skipWs(s, i);

            if (*key == "level_id") {
                const auto value = detail::parseString(s, i);
                if (!value.has_value()) {
                    return std::nullopt;
                }
                rec.level_id = *value;
                haveId = true;
            } else if (*key == "level_name") {
                const auto value = detail::parseString(s, i);
                if (!value.has_value()) {
                    return std::nullopt;
                }
                rec.level_name = *value;
                haveName = true;
            } else if (*key == "percentage") {
                const auto value = detail::parseInt(s, i);
                if (!value.has_value()) {
                    return std::nullopt;
                }
                rec.percentage = *value;
                havePct = true;
            } else {
                return std::nullopt;  // unexpected key
            }

            detail::skipWs(s, i);
            if (i >= s.size()) {
                return std::nullopt;
            }
            if (s[i] == ',') {
                ++i;
                continue;
            }
            if (s[i] == '}') {
                ++i;
                break;
            }
            return std::nullopt;
        }

        if (!haveId || !haveName || !havePct || rec.level_id.empty()) {
            return std::nullopt;
        }
        return rec;
    }
};

}  // namespace tracker
