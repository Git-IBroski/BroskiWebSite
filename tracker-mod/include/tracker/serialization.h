#pragma once

/**
 * Pure, Geode-independent serialization and batching for the Tracker_Mod's
 * Initial_Sync upload (task 8.4).
 *
 * This header has NO dependency on the Geode SDK or Geometry Dash headers and
 * uses ONLY the C++ standard library, so it builds and is property-tested under
 * -DTRACKER_BUILD_TESTS=ON on any machine with a C++20 toolchain (Property 10,
 * task 8.7). It builds on the `ValidCompletion` struct from completion_filter.h
 * (task 8.3).
 *
 * To keep the pure-logic test target free of external dependencies, JSON is
 * serialized and parsed by hand for this exact schema only:
 *
 *   [ { "level_id": "<string>", "level_name": "<string>", "percentage": <int> }, ... ]
 *
 * matching the design's "API Payload Specification" (Phase 1 bulk sync array).
 * An empty completion list serializes to the literal "[]".
 *
 * Requirements:
 *   1.4  - serialize valid completions into a single JSON array (including an
 *          empty array when no valid completions exist); the mod may collect up
 *          to 100,000 entries and must chunk them into uploadable batches.
 *   6.2  - each request payload is an array of 1..1000 records.
 *   10.4 - each request body must not exceed 64 kilobytes.
 */

#include <cctype>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "tracker/completion_filter.h"

namespace tracker {

// Batching limits (Req 6.2, 10.4). A batch must have <= kMaxBatchRecords records
// AND its serialized JSON must be <= kMaxBatchBytes bytes.
inline constexpr std::size_t kMaxBatchRecords = 1000;
inline constexpr std::size_t kMaxBatchBytes = 64 * 1024;  // 64 KB == 65536 bytes

// ---------------------------------------------------------------------------
// JSON string escaping / unescaping (RFC 8259, minimal subset)
// ---------------------------------------------------------------------------

/**
 * Appends `s` to `out` as a quoted, escaped JSON string literal.
 *
 * Strings are treated as opaque byte sequences: control characters (< 0x20),
 * the quote, and the backslash are escaped; all other bytes (including bytes
 * >= 0x80) are emitted verbatim so the exact byte content round-trips.
 */
inline void appendJsonString(std::string& out, const std::string& s) {
    out.push_back('"');
    for (const char ch : s) {
        const unsigned char c = static_cast<unsigned char>(ch);
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b";  break;
            case '\f': out += "\\f";  break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (c < 0x20) {
                    // Other control characters: \u00XX.
                    static const char* kHex = "0123456789abcdef";
                    out += "\\u00";
                    out.push_back(kHex[(c >> 4) & 0xF]);
                    out.push_back(kHex[c & 0xF]);
                } else {
                    out.push_back(ch);
                }
                break;
        }
    }
    out.push_back('"');
}

/**
 * Serializes a single completion object to `out` as:
 *   {"level_id":"...","level_name":"...","percentage":N}
 */
inline void appendJsonCompletion(std::string& out, const ValidCompletion& c) {
    out += "{\"level_id\":";
    appendJsonString(out, c.level_id);
    out += ",\"level_name\":";
    appendJsonString(out, c.level_name);
    out += ",\"percentage\":";
    out += std::to_string(c.percentage);
    out.push_back('}');
}

/**
 * Serializes a list of completions to a JSON array string (Req 1.4).
 *
 * Each element is { "level_id": "...", "level_name": "...", "percentage": N }.
 * An empty list serializes to "[]".
 */
inline std::string serializeCompletions(const std::vector<ValidCompletion>& completions) {
    std::string out;
    out.push_back('[');
    for (std::size_t i = 0; i < completions.size(); ++i) {
        if (i != 0) {
            out.push_back(',');
        }
        appendJsonCompletion(out, completions[i]);
    }
    out.push_back(']');
    return out;
}

/**
 * Returns the serialized byte length of a single completion as it would appear
 * inside the JSON array (object only, no separators). Used so batching can size
 * a batch without repeatedly re-serializing the whole array.
 */
inline std::size_t serializedSize(const ValidCompletion& c) {
    std::string tmp;
    appendJsonCompletion(tmp, c);
    return tmp.size();
}

// ---------------------------------------------------------------------------
// Batching (Req 6.2, 10.4)
// ---------------------------------------------------------------------------

/**
 * Splits `completions` into batches such that every batch:
 *   - holds at most kMaxBatchRecords (1000) records (Req 6.2), AND
 *   - serializes (via serializeCompletions) to at most kMaxBatchBytes (64 KB)
 *     bytes (Req 10.4).
 *
 * Records keep their original order across and within batches. An empty input
 * yields no batches (there is nothing to upload). A single record that on its
 * own would exceed the byte budget is still placed in its own batch rather than
 * dropped, so no completion is silently lost; callers may then reject it.
 *
 * Byte accounting mirrors serializeCompletions exactly: 2 bytes for the
 * enclosing "[]", each record contributes its object length, and each record
 * after the first contributes 1 byte for the "," separator.
 */
inline std::vector<std::vector<ValidCompletion>> chunkCompletions(
    const std::vector<ValidCompletion>& completions) {
    std::vector<std::vector<ValidCompletion>> batches;

    // Fixed overhead of an array body: the enclosing brackets "[]".
    constexpr std::size_t kBracketBytes = 2;

    std::vector<ValidCompletion> current;
    // Running serialized size of `current` including its brackets.
    std::size_t currentBytes = kBracketBytes;

    for (const auto& c : completions) {
        const std::size_t recBytes = serializedSize(c);
        // Separator cost: a comma is needed only if `current` already has items.
        const std::size_t sepBytes = current.empty() ? 0 : 1;
        const std::size_t projected = currentBytes + sepBytes + recBytes;

        const bool recordLimitHit = current.size() >= kMaxBatchRecords;
        const bool byteLimitHit = !current.empty() && projected > kMaxBatchBytes;

        if (recordLimitHit || byteLimitHit) {
            batches.push_back(std::move(current));
            current.clear();
            currentBytes = kBracketBytes;
        }

        const std::size_t addSep = current.empty() ? 0 : 1;
        current.push_back(c);
        currentBytes += addSep + recBytes;
    }

    if (!current.empty()) {
        batches.push_back(std::move(current));
    }

    return batches;
}

/**
 * Convenience variant of chunkCompletions that returns each batch already
 * serialized to its JSON array string, ready to be used as an HTTP request body.
 */
inline std::vector<std::string> chunkCompletionsSerialized(
    const std::vector<ValidCompletion>& completions) {
    std::vector<std::string> out;
    for (const auto& batch : chunkCompletions(completions)) {
        out.push_back(serializeCompletions(batch));
    }
    return out;
}

// ---------------------------------------------------------------------------
// JSON parsing (minimal, for the exact completion-array schema)
// ---------------------------------------------------------------------------

namespace detail {

/**
 * A tiny recursive-descent parser over the exact completion-array schema. It is
 * intentionally minimal: it understands JSON arrays of objects whose values are
 * either JSON strings or integers, which is all serializeCompletions emits. Any
 * structural deviation returns std::nullopt so the round-trip (Property 10) can
 * assert a clean parse.
 */
class CompletionParser {
public:
    explicit CompletionParser(const std::string& src) : s_(src) {}

    std::optional<std::vector<ValidCompletion>> parseArray() {
        skipWs();
        if (!consume('[')) {
            return std::nullopt;
        }
        std::vector<ValidCompletion> result;
        skipWs();
        if (peek() == ']') {
            ++pos_;
            skipWs();
            return atEnd() ? std::optional{result} : std::nullopt;
        }
        while (true) {
            auto obj = parseObject();
            if (!obj.has_value()) {
                return std::nullopt;
            }
            result.push_back(std::move(*obj));
            skipWs();
            const char c = peek();
            if (c == ',') {
                ++pos_;
                skipWs();
                continue;
            }
            if (c == ']') {
                ++pos_;
                break;
            }
            return std::nullopt;
        }
        skipWs();
        return atEnd() ? std::optional{result} : std::nullopt;
    }

private:
    std::optional<ValidCompletion> parseObject() {
        skipWs();
        if (!consume('{')) {
            return std::nullopt;
        }
        ValidCompletion out;
        bool haveId = false, haveName = false, havePct = false;

        skipWs();
        if (peek() == '}') {
            ++pos_;
            return std::nullopt;  // empty object lacks required fields
        }

        while (true) {
            skipWs();
            auto key = parseString();
            if (!key.has_value()) {
                return std::nullopt;
            }
            skipWs();
            if (!consume(':')) {
                return std::nullopt;
            }
            skipWs();
            if (*key == "level_id") {
                auto v = parseString();
                if (!v.has_value()) return std::nullopt;
                out.level_id = std::move(*v);
                haveId = true;
            } else if (*key == "level_name") {
                auto v = parseString();
                if (!v.has_value()) return std::nullopt;
                out.level_name = std::move(*v);
                haveName = true;
            } else if (*key == "percentage") {
                auto v = parseInt();
                if (!v.has_value()) return std::nullopt;
                out.percentage = *v;
                havePct = true;
            } else {
                return std::nullopt;  // unknown key for this schema
            }

            skipWs();
            const char c = peek();
            if (c == ',') {
                ++pos_;
                continue;
            }
            if (c == '}') {
                ++pos_;
                break;
            }
            return std::nullopt;
        }

        if (!haveId || !haveName || !havePct) {
            return std::nullopt;
        }
        return out;
    }

    std::optional<std::string> parseString() {
        if (!consume('"')) {
            return std::nullopt;
        }
        std::string out;
        while (!atEnd()) {
            const char ch = s_[pos_++];
            if (ch == '"') {
                return out;
            }
            if (ch == '\\') {
                if (atEnd()) {
                    return std::nullopt;
                }
                const char esc = s_[pos_++];
                switch (esc) {
                    case '"':  out.push_back('"');  break;
                    case '\\': out.push_back('\\'); break;
                    case '/':  out.push_back('/');  break;
                    case 'b':  out.push_back('\b'); break;
                    case 'f':  out.push_back('\f'); break;
                    case 'n':  out.push_back('\n'); break;
                    case 'r':  out.push_back('\r'); break;
                    case 't':  out.push_back('\t'); break;
                    case 'u': {
                        if (pos_ + 4 > s_.size()) {
                            return std::nullopt;
                        }
                        unsigned int cp = 0;
                        for (int i = 0; i < 4; ++i) {
                            const int d = hexValue(s_[pos_++]);
                            if (d < 0) {
                                return std::nullopt;
                            }
                            cp = (cp << 4) | static_cast<unsigned int>(d);
                        }
                        appendUtf8(out, cp);
                        break;
                    }
                    default:
                        return std::nullopt;
                }
            } else {
                out.push_back(ch);
            }
        }
        return std::nullopt;  // unterminated string
    }

    std::optional<int> parseInt() {
        skipWs();
        const std::size_t start = pos_;
        if (peek() == '-') {
            ++pos_;
        }
        std::size_t digits = 0;
        while (!atEnd() && std::isdigit(static_cast<unsigned char>(s_[pos_]))) {
            ++pos_;
            ++digits;
        }
        if (digits == 0) {
            return std::nullopt;
        }
        try {
            return std::stoi(s_.substr(start, pos_ - start));
        } catch (...) {
            return std::nullopt;
        }
    }

    static int hexValue(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return -1;
    }

    static void appendUtf8(std::string& out, unsigned int cp) {
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

    void skipWs() {
        while (!atEnd()) {
            const char c = s_[pos_];
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                ++pos_;
            } else {
                break;
            }
        }
    }

    char peek() const { return atEnd() ? '\0' : s_[pos_]; }
    bool atEnd() const { return pos_ >= s_.size(); }
    bool consume(char expected) {
        if (peek() == expected) {
            ++pos_;
            return true;
        }
        return false;
    }

    const std::string& s_;
    std::size_t pos_ = 0;
};

}  // namespace detail

/**
 * Parses a JSON array string produced by serializeCompletions back into a list
 * of completions (task 8.7 / Property 10 round-trip). Returns std::nullopt when
 * the input is not a well-formed array of completion objects for this schema.
 *
 * Round-trip guarantee:
 *   parseCompletions(serializeCompletions(xs)) == xs   for all valid xs.
 */
inline std::optional<std::vector<ValidCompletion>> parseCompletions(const std::string& json) {
    detail::CompletionParser parser(json);
    return parser.parseArray();
}

}  // namespace tracker
