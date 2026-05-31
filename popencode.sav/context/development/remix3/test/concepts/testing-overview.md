# Concept: Remix Test Framework

**Purpose**: Test framework for Remix 3 applications with unit, E2E, and coverage

## Core Idea

Remix provides a built-in test framework (`remix/test`) that combines server-side unit testing, Playwright E2E testing, and unified code coverage reporting in a single CLI. Tests use a familiar `describe`/`it` structure with hooks.

## Key Points

- `describe`/`it` API with `before`/`after`/`beforeEach`/`afterEach` hooks
- Server-side unit testing + Playwright E2E testing via `t.serve`
- Mock functions and method spies via `t.mock.fn` / `t.mock.method`
- Unified code coverage across unit and E2E tests
- Config file (`remix-test.config.ts`) or CLI flags
- Test discovery via glob patterns (default: `**/*.test.{ts,tsx}`)

## Quick Example

```ts
import * as assert from 'remix/assert'
import { describe, it, beforeAll } from 'remix/test'

describe('Math Utils', () => {
  it('adds numbers', () => {
    assert.equal(1 + 1, 2)
  })
})
```

**Reference**: `packages/test/README.md`

**Related**:
- examples/test-examples.md
- guides/e2e-testing.md
- guides/test-config.md