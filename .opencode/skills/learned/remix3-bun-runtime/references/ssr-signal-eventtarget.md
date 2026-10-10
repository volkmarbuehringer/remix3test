# SSR `handle.signal` Is Not an `AbortSignal` — Bun Rejects It

**Source:** `remix3-bun-runtime`

**Extracted:** 2026-09-19

**Context:** A Remix 3 component registers `addEventListener(..., { signal: handle.signal })` during SSR and passes under Node but throws under Bun.

## Problem

`@remix-run/component`'s server runtime gives every component `signal: ssrSignal`, a frozen plain object (`@remix-run/component/dist/server/stream.js`), not an `AbortSignal`. So `handle.frame.addEventListener(type, fn, { signal: handle.signal })` in component setup throws `TypeError: Type error` under Bun. Node does **not** reject the real `ssrSignal` shape — its `EventTarget` duck-types any object exposing `addEventListener` — which is why the Node suite stays green on the unguarded code.

## Solution

Frame/DOM reload events only fire in the browser, so guard registration:

```ts
if (typeof document !== 'undefined') {
  handle.frame.addEventListener('reloadComplete', reloadFromFrame, { signal: handle.signal })
}
```

Repro of the divergence (the real `ssrSignal` exposes a no-op `addEventListener`, so Node duck-types it): `new EventTarget().addEventListener('x', () => {}, { signal: Object.freeze({ addEventListener() {}, removeEventListener() {} }) })` → Node accepts, Bun throws `Type error`. A plain `Object.freeze({})` throws on **both**, so it does not reproduce the Node/Bun split. Sweep every `addEventListener(..., { signal: handle.signal })` that can run during SSR.

## Guarding against regression

Typecheck and Node tests structurally cannot catch an unguarded registration:

- `Handle.signal` is declared `AbortSignal` (`@remix-run/component` `runtime/component.d.ts`), so `tsc` and `bun check` accept the call.
- Node duck-types the `ssrSignal` shape, so the whole Node suite passes on the broken code.

Run the guard under Bun. `renderToString()` executes a `clientEntry`'s setup body during SSR (`buildEntrySegment` → `buildComponentSegment` in `server/stream.js`), so a `.test.tsx` server test that renders the entry goes red under `test:bun` when the registration is unguarded:

```tsx
// app/actions/lists/public/lists-search.test.tsx
import { renderToString } from 'remix/component/server'
import { ListsSearch } from './lists-search.tsx'

it('server-renders without registering frame listeners', async () => {
  let html = await renderToString(<ListsSearch />)
  assert.ok(html.length > 0)
})
```

Fails under Bun with `Type error` at the registration line, passes under Node. Confirm red/green by reverting the guard:

```sh
NODE_ENV=test bun node_modules/remix/dist/cli-entry.js test --type server \
  app/actions/lists/public/lists-search.test.tsx
```

Version-pinned facts (verified 2026-10-10, Bun 1.4.3, remix build `044d83772`): `handle.frame` is a real `TypedEventTarget` (`createFrameHandle()` returns `new TypedEventTarget()`), the SSR `signal` is `Object.freeze({...})` with a no-op `addEventListener`, and Node's `addEventListener` accepts that exact object while rejecting `Object.freeze({})`.
