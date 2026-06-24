/**
 * Tracker_Mod — in-memory diagnostic log buffer (implementation).
 *
 * Standard-library only; safe to call from any thread. Stores at most kMaxLines
 * recent entries, each prefixed with a wall-clock HH:MM:SS timestamp so the
 * in-game popup reads like a mini console.
 */
#include "diag_log.hpp"

#include <chrono>
#include <ctime>
#include <deque>
#include <mutex>

namespace tracker {

namespace {

std::mutex g_mutex;
std::deque<std::string> g_lines;
constexpr std::size_t kMaxLines = 200;

std::string timestamp() {
    const auto now = std::chrono::system_clock::now();
    const std::time_t t = std::chrono::system_clock::to_time_t(now);
    std::tm tm{};
#if defined(_WIN32)
    localtime_s(&tm, &t);
#else
    localtime_r(&t, &tm);
#endif
    char buf[16];
    std::strftime(buf, sizeof(buf), "%H:%M:%S", &tm);
    return std::string(buf);
}

}  // namespace

void diagAdd(const std::string& line) {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_lines.push_back(timestamp() + "  " + line);
    while (g_lines.size() > kMaxLines) {
        g_lines.pop_front();
    }
}

std::vector<std::string> diagSnapshot() {
    std::lock_guard<std::mutex> lock(g_mutex);
    return std::vector<std::string>(g_lines.begin(), g_lines.end());
}

}  // namespace tracker
