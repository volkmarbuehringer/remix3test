# SSR `handle.signal` Is Not an `AbortSignal` — Bun Rejects It

**Source:** `remix3-bun-runtime`

**Extracted:** 2026-09-19

**Context:** A Remix 3 component registers `addEventListener(..., { signal: handle.signal })` during SSR and passes under Node but throws under Bun.

## Problem

`@remix-run/component`'s server runtime gives every component `signal: ssrSignal`, a frozen plain object (`@remix-run/component/dist/server/stream.js`), not an `AbortSignal`. So `handle.frame.addEventListener(type, fn, { signal: handle.signal })` in component setup throws `TypeError: Type error` under Bun; Node tolerates the non-AbortSignal (it only rejects `null`).

## Solution

Frame/DOM reload events only fire in the browser, so guard registration:

```ts
if (typeof document !== 'undefined') {
  handle.frame.addEventListener('reloadComplete', reloadFromFrame, { signal: handle.signal })
}
```

Repro: `bun -e 'new EventTarget().addEventListener("x", () => {}, { signal: Object.freeze({}) })'` → `TypeError: Type error`; Node accepts it. Sweep every `addEventListener(..., { signal: handle.signal })` that can run during SSR.
