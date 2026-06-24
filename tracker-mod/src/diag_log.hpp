#pragma once

/**
 * Tracker_Mod — in-memory diagnostic log buffer.
 *
 * A tiny, thread-safe ring buffer of recent diagnostic lines. The Initial_Sync
 * worker thread and the main-thread hooks append to it; the MenuLayer "DTT"
 * button reads a snapshot to render an in-game console-style popup. This lets us
 * see exactly what the mod is doing without depending on Geode's on-disk log
 * file (whose tail can lag behind while the game is still running).
 *
 * Depends only on the C++ standard library.
 */
#include <string>
#include <vector>

namespace tracker {

/** Append one diagnostic line (thread-safe). Oldest lines are dropped past cap. */
void diagAdd(const std::string& line);

/** A copy of the currently buffered lines, oldest first (thread-safe). */
std::vector<std::string> diagSnapshot();

}  // namespace tracker
