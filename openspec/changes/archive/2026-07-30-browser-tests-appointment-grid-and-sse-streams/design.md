## Context

See `proposal.md` for motivation. The app uses `remix/ui/test`'s `render()` helper for browser tests, running in isolated Playwright frames via the `**/*.test.browser.{ts,tsx}` pattern. The existing `appointment-grid.test.browser.ts` tests isolated DOM/CSS primitives at ~663 lines — it creates raw DOM fixtures, not the actual component.

## Goals / Non-Goals

**Goals:**
- Test the actual imported `clientEntry` components (appointment grid, SSE streams) in a Playwright browser frame using `render()`
- Cover the gesture-driven behaviors (drag, resize, type-drag, delete) in the appointment grid
- Cover the SSE lifecycle (connect, stream, tool cards, abort, retry) across all 6 agent stream components
- Parameterize tests where stream components share identical patterns (SSE pump, abort, scroll)
- Test the `interactionState` coordination flag between grid and SSE subscribers

**Non-Goals:**
- Testing server-side behavior (already covered by router/integration tests)
- Testing CSS rendering primitives (already covered by existing test file)
- E2E tests (server + browser together) — these belong in `.test.e2e.ts`
- Testing all 6 context menu files (separate change)

## Decisions

### 1. Use `render()` from `remix/ui/test` with real component import
The existing browser test creates raw DOM fixtures. For gesture/integration tests, import the actual clientEntry component and render it in an isolated DOM subtree. This tests the real event handlers and state management.

**Alternatives considered:**
- Raw DOM fixtures (current approach) — doesn't exercise actual component logic, misses gesture coordination bugs
- Playwright E2E with full page — heavier, requires server running, tests too much at once

### 2. Mock SSE for stream component tests
SSE streams require a backend. Tests should create a local EventSource mock or intercept `EventSource` constructor to inject synthetic SSE events (open, message, error, close).

**Approach:**
- Replace `window.EventSource` with a mock class that accepts an array of events
- Each test defines events to emit (connect → stream chunks → tool cards → complete)
- Assert on DOM state after events are processed

### 3. Test appointment grid gestures via pointer event dispatch
Appointment grid gestures are driven by `pointerdown`, `pointermove`, `pointerup` on the grid element. Tests dispatch these events with specific coordinates and assert on block position/mutation capture.

**Approach:**
- Render the grid component via `render()`
- Dispatch `PointerEvent` sequences at coordinates that trigger known behaviors (drag by 60px, resize by 30px, etc.)
- Intercept `fetch()` to verify mutations were sent with correct payloads

### 4. Parameterize SSE stream tests
All 6 stream components share the same SSE EventSource pattern. A shared test helper defines the common behavior matrix, and each component gets a parameterized run:

```
testScenarios.forEach(scenario =>
  it(`[${component name}] ${scenario.name}`, ...)
)
```

### 5. One test file per capability
- `appointment-grid-gestures.test.browser.tsx` — gesture tests for the grid
- `sse-agent-streams.test.browser.tsx` — parameterized tests for all 6 stream components

## Risks / Trade-offs

- **[Risk] Drag gesture tests are coordinate-sensitive** — if grid layout constants (SLOT_HEIGHT, SUB_SLOTS, etc.) change, pointer coordinates in tests break. → **Mitigation**: derive test coordinates from the same constants the grid uses, or add a test helper that computes positions from slot values
- **[Risk] SSE mock diverges from real EventSource behavior** — if the real browser's EventSource has edge cases the mock doesn't replicate, tests pass but production breaks. → **Mitigation**: keep mock minimal; test the real disconnect/reconnect patterns in e2e tests
- **[Trade-off] Appointment grid tests test the render output of a 1291-line component** — these are integration-level browser tests, not unit tests. Test failures will require debugging the full pipeline, not just one function
