cmake_minimum_required(VERSION 3.21)

# C++20 is required by the Geode SDK.
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

project(DemonTierTracker VERSION 0.1.0 LANGUAGES CXX)

# ---------------------------------------------------------------------------
# Pure-logic tests (rapidcheck) - buildable WITHOUT the Geode SDK / GD headers.
#
# The pure logic implemented in later tasks (completion filtering, serialization
# round-trip, higher-only gating, retry-queue invariants, token validation) lives
# under `include/tracker/` and depends only on the C++ standard library, so it can
# be compiled and property-tested on any machine with a C++20 toolchain.
#
#   cmake -S tracker-mod -B tracker-mod/build-tests -DTRACKER_BUILD_TESTS=ON
#   cmake --build tracker-mod/build-tests
#   ctest --test-dir tracker-mod/build-tests --output-on-failure
# ---------------------------------------------------------------------------
option(TRACKER_BUILD_TESTS "Build the pure-logic rapidcheck tests (no Geode SDK required)" OFF)

if(TRACKER_BUILD_TESTS)
    enable_testing()
    add_subdirectory(test)
    return()
endif()

# ---------------------------------------------------------------------------
# Geode mod build (requires the Geode SDK toolchain).
# ---------------------------------------------------------------------------
file(GLOB_RECURSE TRACKER_SOURCES CONFIGURE_DEPENDS src/*.cpp)

add_library(${PROJECT_NAME} SHARED ${TRACKER_SOURCES})

target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

if(NOT DEFINED ENV{GEODE_SDK})
    message(FATAL_ERROR
        "Unable to find the Geode SDK. Set the GEODE_SDK environment variable to "
        "your Geode SDK checkout (see tracker-mod/README.md). To build only the "
        "pure-logic tests instead, configure with -DTRACKER_BUILD_TESTS=ON.")
else()
    message(STATUS "Found Geode SDK: $ENV{GEODE_SDK}")
endif()

add_subdirectory($ENV{GEODE_SDK} ${CMAKE_CURRENT_BINARY_DIR}/geode)

setup_geode_mod(${PROJECT_NAME})
