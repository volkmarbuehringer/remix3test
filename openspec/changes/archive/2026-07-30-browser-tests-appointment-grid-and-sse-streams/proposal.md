## Why

The app has 34 `.browser.tsx` files producing interactive behavior but only 1 browser test (`appointment-grid.test.browser.ts`) — which covers CSS rendering primitives rather than actual gesture handling. The two largest untested surfaces are the appointment grid (1291 lines, the core booking interaction) and the SSE agent stream components (6 files, 3.5k+ lines combined). These implement complex asynchronous state machines with no regression safety net.

## What Changes

- Add browser tests for the appointment grid's gesture-driven interactions (drag-drop, drag-resize, type-drag-create, inline rename, trashcan delete)
- Add browser tests for the SSE-based agent stream components (customer-chat, test-agent, support-agent, workflow-agent, route-agent, agent-events)
- The existing `appointment-grid.test.browser.ts` will remain; its CSS/rendering tests are still valid

## Capabilities

### New Capabilities

- `appointment-grid-gestures`: Browser tests for the appointment grid's pointer gesture interactions — drag to move, drag to resize, type-drag to create, drop on trashcan to delete, and inline rename via click-to-edit
- `sse-agent-streams`: Browser tests for the SSE agent stream lifecycle — connection, streaming message display, tool card rendering, abort/retry, step progress rendering, and scroll-to-bottom behavior

### Modified Capabilities

<!-- No existing capabilities have requirement changes. -->

## Impact

- Test files: 2 new `.test.browser.tsx` files (one per capability), plus shared test helpers
- Source files: None modified — tests import existing browser components
- Dependencies: Remix test runner already supports browser tests via `**/*.test.browser.{ts,tsx}` pattern
