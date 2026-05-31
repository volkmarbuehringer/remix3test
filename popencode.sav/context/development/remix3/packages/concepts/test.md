<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Test Framework

**Purpose**: `remix/test` is the built-in test framework for Remix apps — server unit tests, Playwright E2E, and in-browser component testing, all with `describe`/`it` structure, mocks, coverage, and watch mode.

## Key Points

- **Test types**: `server` (unit), `browser` (in-browser via Playwright iframe), `e2e` (Playwright)
- **CLI**: `remix test` or standalone `remix-test` binary; pass globs as positional args
- **Glob patterns**: `**/*.test.ts` (server), `**/*.test.browser.ts`, `**/*.test.e2e.ts` — configurable via `glob.*`; `glob.exclude` filters paths (defaults to `node_modules/**`)
- **API**: `describe`/`it` (aliases `suite`/`test`), `beforeAll`/`afterAll`/`beforeEach`/`afterEach`; `describe.skip` / `describe.only` propagate to nested describes
- **Mocks**: `t.mock.fn()` and `t.mock.method()` on `TestContext` (auto-restored after test)
- **Fake timers**: `t.useFakeTimers()` with `advance(ms)` (sync) and `advanceAsync(ms)` (with microtask yielding)
- **E2E**: `t.serve(server)` returns a Playwright `Page` pointed at test server
- **Browser tests**: `render()` from `remix/ui/test` mounts components with `$`, `$$`, `act()`, `cleanup()`
- **Coverage**: Unified across unit + E2E via `coverage` config (statements, lines, branches, functions)
- **Pool**: `forks` (default, child processes) or `threads` (worker threads); browser/E2E use forks
- **Reporters**: `spec` (default), `files`, `tap`, `dot`
- **Programmatic**: `runRemixTest({ argv, cwd })` from `remix/test/cli` returns exit code

## Quick Example

```ts
import * as assert from 'remix/assert'
import { describe, it, mock } from 'remix/test'
import { render } from 'remix/ui/test'

describe('Counter', () => {
  it('increments', async (t) => {
    let { $, act, cleanup } = render(<Counter />)
    t.after(cleanup)
    
    assert.equal($('[data-count]')?.textContent, '0')
    await act(() => $('[data-action="inc"]')?.click())
    assert.equal($('[data-count]')?.textContent, '1')
  })
})
```

**Config**: `remix-test.config.ts` with `browser`, `concurrency`, `coverage`, `glob`, `playwrightConfig`, `reporter`, `pool`, `setup`, `type`, `watch`

## Reference

Source: `~/remix/packages/test/src/` and `~/remix/packages/test/README.md`
CHANGELOG: `~/remix/packages/test/CHANGELOG.md`
