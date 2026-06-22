cmake_minimum_required(VERSION 3.21)

# Pure-logic test target. Does NOT depend on the Geode SDK or GD headers.
project(DemonTierTrackerTests LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

# rapidcheck is the property-based testing library used for the C++ pure logic
# (Testing Strategy: rapidcheck, minimum 100 iterations).
FetchContent_Declare(
    rapidcheck
    GIT_REPOSITORY https://github.com/emil-e/rapidcheck.git
    GIT_TAG ff6af6fc683159deb51c543b065eba14dfcf329b
)
FetchContent_MakeAvailable(rapidcheck)

file(GLOB_RECURSE TRACKER_TEST_SOURCES CONFIGURE_DEPENDS *.cpp)

add_executable(tracker_tests ${TRACKER_TEST_SOURCES})

target_include_directories(tracker_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../include
)

target_link_libraries(tracker_tests PRIVATE rapidcheck)

add_test(NAME tracker_tests COMMAND tracker_tests)

# Enforce the design's minimum of >=100 iterations per property. rapidcheck reads
# its configuration from the RC_PARAMS environment variable; max_success=100 makes
# every property attempt at least 100 successful cases.
set_tests_properties(tracker_tests PROPERTIES
    ENVIRONMENT "RC_PARAMS=max_success=100"
)
