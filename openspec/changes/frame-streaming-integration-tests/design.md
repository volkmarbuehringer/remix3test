## Context

The app's frame system is a core architectural pattern: admin and AI sections load content via `<Frame name="adminContent">` and `<Frame name="aiContent">`, and nested fragments (stats, activity, agent results, chatlog details) stream independently. This pattern is invisible to standard `response.text()` tests because they wait for the full response, missing the incremental streaming behavior entirely.

The `frames-demo` project has an integration test (`router.test.ts`) that verifies frame streaming by consuming the response body as a stream, checking that fallback content appears first, then `<template>` tags wrap resolved frame content, and nested frames resolve incrementally. newapp has no equivalent test — a broken `resolveFrame` callback or malformed frame response would go undetected.

## Goals / Non-Goals

**Goals:**

- Create `app/router.test.ts` with integration tests that validate frame streaming behavior across the admin and AI sections
- Test that fallback content streams before frame content (progressive enhancement)
- Test that resolved frame content is wrapped in `<template>` tags
- Test that fragment endpoints render without Layout wrappers
- Test that non-existent fragment endpoints produce useful error content
- Reuse the existing auth helper patterns (`createAuthCookie` / login flow) for authenticated endpoints
- Pattern the streaming helpers (`readChunks`, `readUntil`, `countTemplates`) on the proven frames-demo implementation

**Non-Goals:**

- No changes to production code
- No changes to existing test infrastructure
- No changes to frame rendering behavior
- No testing of client-side hydration or `clientEntry` behavior (server streaming only)
- No testing of SSE, form submissions, or other non-frame routes

## Decisions

### Decision 1: Single test file at `app/router.test.ts`

**Chosen:** A single integration test file at the router level, mirroring the frames-demo approach.

**Alternative considered:** Per-controller streaming tests in each controller's test file. Scattered tests would be harder to maintain and each would need to duplicate the streaming helper utilities.

**Rationale:** The frame streaming behavior is a cross-cutting concern of the render middleware, not of individual controllers. A single file at the router level keeps the streaming helpers in one place and makes the integration contract explicit: "the router correctly streams frames."

### Decision 2: Streaming helpers patterned on frames-demo

**Chosen:** Replicate `readChunks`, `readUntil`, and `countTemplates` from frames-demo's `router.test.ts`, adapted to use `remix/assert` instead of `node:assert/strict`.

**Alternatives considered:** Abstract the helpers into `app/test-utils.ts`. Over-engineering for three small functions used in one test file.

**Rationale:** Frames-demo's helpers are proven (they work correctly for verifying streaming behavior). Keeping them local to the test file makes the streaming logic transparent and avoids premature abstraction.

### Decision 3: Authenticate via login flow (same as existing tests)

**Chosen:** Each test group authenticates by POSTing to `/login` and extracting the session cookie, exactly as `admin-fragments-controller.test.ts` and `layout.test.ts` do.

**Alternative considered:** Use the DB-backed `createAuthCookie` helper from `test-utils.ts`. That helper queries the users table directly, which couples the test to DB state. The login flow tests the real auth path.

**Rationale:** Consistency with existing tests. The login flow is already tested and fast (~50ms per auth call in CI). A single `before` hook authenticates once per test group.

### Decision 4: Test admin and AI pages separately

**Chosen:** Separate `describe` blocks for admin page streaming, AI page streaming, fragment endpoints, and error handling.

**Alternative considered:** One giant streaming test covering both sections. Harder to isolate failures.

**Rationale:** Separate test groups make it clear which section has a streaming issue. Each group authenticates once in its `before` hook and shares the cookie.

### Decision 5: Check for `<template>` tag presence, not exact content

**Chosen:** Tests assert that `<template` appears in the HTML stream at the right time, and that specific text content is present in resolved frames. They do not assert exact HTML structure.

**Alternative considered:** Snapshot-based testing of the full streaming output. Brittle — any CSS or layout change would break the snapshot without indicating a real streaming regression.

**Rationale:** The streaming test should verify the _mechanics_ of frame resolution (fallback first, template wrapping, content arrival), not pixel-perfect HTML. Content assertions on key text strings provide sufficient coverage.

## Risks / Trade-offs

- **Stream consumption exhausts the body** — Once a `ReadableStream` is consumed by `readChunks()`, it can't be read again. Each test case needs its own `router.fetch()` call. Mitigation: well-known pattern, same as frames-demo.

- **Auth cookies expire during long test runs** — The session cookie has a 30-day maxAge, so this is not a risk for CI runs. If tests are paused mid-run, the before hook re-authenticates.

- **Timing-dependent streaming behavior** — Fallback content must appear before frame content in the stream. If the render implementation changes (e.g., to buffer frames before flushing), tests would need updating. Mitigation: the tests check logical ordering (fallback before frame), not timing (milliseconds between chunks).

- **Database dependency** — Tests require a running PostgreSQL with seeded data. This is the same requirement as all existing integration tests.
