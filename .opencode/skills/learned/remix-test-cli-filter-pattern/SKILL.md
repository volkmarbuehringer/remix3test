---
name: remix-test-cli-filter-pattern
description: "`remix test` uses positional glob args and `--type` to filter tests, not `--run` like Vitest/Jest."
user-invocable: false
origin: auto-extracted
---

# Remix 3: `remix test` CLI Filter Syntax

**Extracted:** 2026-06-05
**Context:** Attempted `--run` (Vitest convention) to filter tests; `remix test` rejects it with `RMX_INTERNAL_ERROR`.

## Problem

`remix test` does NOT support `--run <pattern>` like Vitest or Jest. Passing `--run` causes `Error [RMX_INTERNAL_ERROR] Unknown option '--run'`.

## Solution

Pass the glob pattern as a **positional argument** (first arg) and use `--type` to filter test categories:

```sh
# Run a single test file
remix test "**/appointofferings*" --type=server

# Run all tests matching a pattern
remix test "**/appointments*" --type=server

# Run all server tests (default)
remix test

# Run all tests including browser and e2e
remix test "**/*.test.*"

# Run with coverage (separate flag, not part of filter)
remix test --coverage
```

Note: Quoting the glob pattern with `**/` prefix is necessary because the glob resolution happens relative to the project root, and the pattern must match the full path from the project root.

## Available `--type` values

- `server` — server-side tests (default when omitted? depends on config)
- `browser` — browser/component tests
- `e2e` — Playwright E2E tests

## When to Use

- Running a focused subset of tests matching a filename pattern
- `--run <pattern>` (Vitest convention) fails with `RMX_INTERNAL_ERROR`
- Working in a Remix 3 project and needing to filter tests from CLI
