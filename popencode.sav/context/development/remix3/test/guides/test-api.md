<!-- Context: development/remix3/test/guides/test-api | Priority: medium | Version: 2.0 | Updated: 2026-05-21 -->

# Guide: Test Framework API

**Purpose**: Complete API reference for `remix/test` test utilities

## Test Structure

```ts
import { beforeAll, afterAll, beforeEach, afterEach, describe, it } from 'remix/test'

beforeAll(() => {})      // Runs once before all tests in file
afterAll(() => {})       // Runs once after all tests
beforeEach(() => {})     // Runs before each test
afterEach(() => {})      // Runs after each test

describe('My Suite', () => {
  it('tests something', () => {})
})

// Aliases: suite → describe, test → it
```

## Test Context (t)

Each test receives `TestContext` as first argument:

```ts
it('test name', (t) => {
  // Cleanup function - runs after test
  t.after(() => {
    // cleanup logic
  })
  
  // Mock functions
  let fn = t.mock.fn((x: number) => x * 2)
  fn(3)
  fn.mock.calls[0].result // 6
  
  // Mock object methods (spies)
  let spy = t.mock.method(console, 'warn')
  console.warn('test')
  spy.mock.calls.length // 1
  // spy auto-restored after test
})
```

## Standalone Mocks (Module Scope)

```ts
import { mock } from 'remix/test'

let spy = mock.method(console, 'log')
console.log('hello')
spy.mock.calls.length // 1
spy.mock.restore?.()   // manual restore needed
```

---

## Lifecycle Hook Failure Reporting

**Behavior**: Failures in `beforeAll`, `afterEach`, and `afterAll` hooks produce proper `failed` test result entries. Previously these could be silent `console.error` calls that didn't appear in test counts or break test runs.

### How Each Hook Failure Is Reported

| Hook | Effect on Test Run | Reported As |
|------|-------------------|-------------|
| `beforeAll` | Entire suite is skipped after failure | A `"beforeAll"` named failure entry is added to the suite's results |
| `afterEach` | Test that just ran is marked as failed | The test's error includes `"afterEach failed: <message>"` as secondary error |
| `afterAll` | A standalone failure entry is added to the suite | A `"afterAll"` named failure entry is added to the suite's results |

### Implementation Detail (executor.ts)

The executor runs each test in a `try/catch/finally` block:

```ts
try {
  if (suite.beforeEach) await suite.beforeEach()
  await test.fn(testContext)
} catch (error) {
  testFailed = true
  testError = error
} finally {
  await cleanup()
  if (suite.afterEach) {
    try {
      await suite.afterEach()
    } catch (error) {
      afterEachFailed = true  // ← now tracks afterEach failures separately
    }
  }
  if (testFailed || afterEachFailed) {
    // Both test error + afterEach error are combined in the result
    result.error = createTestError(testError, createHookFailure('afterEach', afterEachError))
    results.failed++
  }
}
```

### Key Change (Upstream, c0eb79b)

Previously, lifecycle hook errors (especially `beforeAll` and `afterEach`) could fail silently — logged to `console.error` but not counted in `results.failed` or displayed in reporter output. Now:

1. `beforeAll` failures abort the entire suite and produce a named failure entry
2. `afterEach` failures are merged into the running test's error output
3. `afterAll` failures produce a standalone failure entry
4. All hook failures appear in reporter output (spec/dot/TAP/files)

**Practical impact**: If you see a new test failure after updating the `remix` dependency and your test uses lifecycle hooks, the hook itself may have been failing silently before. The behavior change makes pre-existing hook failures visible.

**Reference**: `packages/@remix-run/test/src/lib/executor.ts` (runTests function)

---

## Related

- concepts/testing-overview.md — Test framework overview
- examples/test-examples.md — Usage examples