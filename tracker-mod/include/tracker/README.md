# Pure logic headers

This directory holds the **Geode-SDK-independent** logic for the Tracker_Mod so it
can be unit- and property-tested on any machine with a C++20 toolchain (no GD
headers required). Keep everything here free of `#include <Geode/...>` so the
`tracker_tests` target builds standalone.

Planned modules (added in later tasks):

| Header (planned)         | Task | Purpose                                                        |
|--------------------------|------|----------------------------------------------------------------|
| `completion_filter.h`    | 8.3  | `RawCompletion`/`ValidCompletion` structs + `filterCompletions()` |
| `serialize.hpp`          | 8.4  | JSON array serialization + ≤1000 / ≤64KB batching              |
| `token.hpp` ✅           | 8.2  | Token validation (reject empty/whitespace, length bounds)      |
| `live_gating.hpp`        | 10.1 | Higher-only gating over a last-reported map                    |
| `retry_queue.hpp`        | 10.2 | One-entry-per-level retry queue holding the highest percentage |
