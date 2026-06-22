/**
 * Example/unit-level coverage for the pure token validator
 * (include/tracker/token.hpp), added in task 8.2.
 *
 * These are deterministic example checks that pin the boundary behavior of
 * `tracker::is_valid_token` and the `trim`/`is_blank` helpers, and they ensure the
 * header is compiled into the `tracker_tests` target. The *named* property test for
 * whitespace rejection (Property 13) is added separately in task 8.8.
 *
 * Exposed as a function (not a `main`) so it links into the single test executable
 * alongside the other pure-logic tests.
 */
#include <rapidcheck.h>

#include <string>

#include <tracker/token.hpp>

bool run_token_tests() {
    using namespace tracker;
    bool ok = true;

    // Empty and whitespace-only tokens are invalid (Req 4.3).
    ok &= rc::check("token: empty is invalid", [] { RC_ASSERT(!is_valid_token("")); });
    ok &= rc::check("token: spaces-only is invalid",
                    [] { RC_ASSERT(!is_valid_token("   ")); });
    ok &= rc::check("token: mixed-whitespace-only is invalid",
                    [] { RC_ASSERT(!is_valid_token("\t \n\r")); });

    // A single non-whitespace character is valid (Req 4.1 lower bound).
    ok &= rc::check("token: single char is valid",
                    [] { RC_ASSERT(is_valid_token("x")); });

    // Content surrounded by whitespace is non-empty after trimming -> valid (Req 4.3).
    ok &= rc::check("token: padded content is valid",
                    [] { RC_ASSERT(is_valid_token("  abc  ")); });

    // Length bounds: 256 valid, 257 invalid (Req 4.1 upper bound).
    ok &= rc::check("token: length 256 is valid",
                    [] { RC_ASSERT(is_valid_token(std::string(256, 'a'))); });
    ok &= rc::check("token: length 257 is invalid",
                    [] { RC_ASSERT(!is_valid_token(std::string(257, 'a'))); });

    // Helper sanity.
    ok &= rc::check("trim: strips both ends",
                    [] { RC_ASSERT(trim("  hi  ") == std::string("hi")); });
    ok &= rc::check("is_blank: whitespace is blank, content is not", [] {
        RC_ASSERT(is_blank("   "));
        RC_ASSERT(!is_blank(" a "));
    });

    return ok;
}
