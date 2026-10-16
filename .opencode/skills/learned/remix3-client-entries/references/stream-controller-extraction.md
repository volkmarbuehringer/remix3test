# Extracting a Stream/Turn State Machine into a Delegate Controller

**Source:** session 2026-10-16 (support-agent / customer-chat / agent-events refactor)

**Context:** `app/assets/streams/public/*.tsx` clientEntries of 449–983 lines mixed
fetch orchestration, retry state machines, thread adoption, and SSE event routing
with DOM rendering. Extracted into sibling `*-controller.ts` factories with a
formal delegate interface; a scoped review then reconciled three shared-shape
contract violations (see step 3). Verified by tsc + oxlint + 1745 server +
122 browser + 54 e2e tests (2 pre-existing skips).

## Problem

`client-entry-decomposition.md`'s five buckets (styles / pure state / network api /
cohesive DOM subsystem / view) don't have a home for the **turn lifecycle** —
run/thread adoption anchors, `lastSubmission` retry, reconnect probes, suspend
gates, the `?new=1` fresh-marker rules, SSE event→UI routing. That logic is what
only browser tests could reach, and what regresses silently.

## Solution

1. One sibling `create<Name>Controller(delegate, options)` factory in the same
   `public/` dir. It is bundled because the entry imports it, and node-testable
   because it imports no DOM-dependent module itself.
2. A `interface <Name>UiDelegate` for **render-only** calls; DOM reads the
   controller needs are delegate methods (`getThreadIdFromDom`, `hasQuestionGate`)
   or trivial `getElementById` inside the controller. Focus/scroll/UI-reset stay
   in the delegate. Closures the entry needs for listeners come out as controller
   guards (`frameFormBusy()`), not shared state.
3. Preserving behavior is the whole risk: copy conditionals verbatim per call
   site — e.g. `preventDefault()` after the GET-form/busy guards but before the
   async work; `pendingQuestion` must be set BEFORE the gate's early `return`
   when the server-rendered card already exists; the `complete` handler must
   clear `lastSubmission` so `retry()` after completion is a no-op.
   Mechanical moves are verbatim; **shared-shaped logic is not**. Once two+
   controllers share a shape, hold each copy to the sibling's invariants during
   the review pass — moving a block verbatim preserves its caller's bugs. All
   three of these shipped in the 2026-10-16 extraction and were caught by the
   scoped review, not by the test suites:

   - A constructor option (`signal`) destructured but never consumed silently
     voided the documented "a stream cannot outlive the component" contract
     while the sibling controller did wire it. Check: every option a controller
     accepts is exercised, or the option is removed.
   - An "active stream" marker (`abortController`) was set on start but only
     cleared on some exit paths, so the reconnect race guard
     (`if (abortController) return`) permanently disabled the probe after the
     first completed command. Check: in-flight markers clear in a `finally`,
     so error/abort/early-return paths all reconcile them.
   - An unguarded `JSON.parse` on a network body threw `SyntaxError` out of a
     helper whose contract is a discriminated `{ ok, message }`. Check: a
     shared transport's parse helper degrades to the fallback message; network
     bodies are untrusted input.

   Post-extraction verification additions: diff each controller's options and
   exit paths against its sibling; give every `void`-started promise a
   settle-tick test; and review with the question "which contract does the
   sibling keep that this copy doesn't".
4. Node tests (`<name>-controller.test.ts`): stub `globalThis.fetch`, drive
   `handleEvent`/gates with a recording delegate, and assert **exact delegate
   call sequences** — they encode the event mapping. Delegate stubs may return
   `'dom-thread'` etc.; `window.location` reads throw in node and are already
   try/caught by the controller.
5. Identical POST-SSE fetch/error-extraction blocks across ≥2 entries go to a
   shared `sse-post.ts` (`fetchSseStream`, `describeSseFailure`, `isAbortError`);
   entries with a distinct 200-non-SSE contract keep their own fetch.

### Test mechanics that bit

- `remix test` path filtering needs full file paths; a directory produces
  `Directory import '...' is not supported`.
- A fetch stub restored in `finally` **before** the fire-and-forget
  `void startStream()` retry runs sends the retry to the real network; restore
  the stub only after the post-retry assertions.
- `await retry()` returns immediately — fire-and-forget methods need a settle
  tick (`setTimeout ~20ms`) before asserting effects.
- Testing a race guard that needs a stream to be genuinely in flight: stub
  fetch to return a `ReadableStream` whose controller you keep, run the
  `void`-started stream, probe the guard, then close the stream so the pending
  `reader.read()` settles and the test can end.
- Controller factories whose guard paths depend on a frame/env check (e.g. the
  gate-render path early-returns when `getPipelineFrame()` is null) need the
  stub to return a dummy object — parameterize the test helper instead of
  asserting a vacuously-empty recording.
- A fetch stub for aborted-path controller tests must **honor the passed
  `init.signal` like a real fetch**: reject with `{ name: 'AbortError' }`
  when the signal aborts, and check `signal.aborted` *first* for a
  pre-aborted signal (`addEventListener` on an already-aborted signal never
  fires). Build the error via a factory that **returns** it —
  `reject(thrower())` where `thrower` throws crashes the worker as an
  uncaught dispatch error instead of rejecting the promise.
- Node-type controller tests have no DOM: `new FormData(form)` throws
  `FormData constructor: Argument 1 could not be converted` even for a plain
  object standing in for a form. Stub `globalThis.FormData` with a minimal
  `class { set(_n, _v) {} }` when only the constructor runs (aborted paths);
  restore it in `finally`.

## When to Use

- A `clientEntry`/`.browser.tsx` holds a fetch/SSE **turn state machine** the
  decomposition buckets won't absorb: retry/reconnect/adoption/gates.
- You need the state machine (not the DOM) unit-testable in the server suite.

## Related

- `client-entry-decomposition.md` — the styles/state/api/drag/view buckets this
  extends; run styles/view extraction FIRST so the controller moves into a
  readable file
- `remix3-testing` — browser-side clientEntry test harnesses (the controller
  tests are *server*-type; the component keeps its browser tests unchanged)
- `typescript-gotchas` — `exactOptionalPropertyTypes`: copied optional props
  need explicit `| undefined` (TS2379); normalizing an optional signal for
  `fetch` needs `?? null`, not `?? undefined` (`RequestInit.signal` accepts
  `AbortSignal | null` — TS2769)
