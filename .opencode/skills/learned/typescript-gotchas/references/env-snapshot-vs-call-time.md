# Env Values Snapshotted at Module Load vs Read at Call Time

**Source:** env-config centralization in a Node/TS app

**Extracted:** 2026-10-06
**Context:** Adding a central `config.ts` that exposes `process.env` values as typed constants, when tests (or request-time logic) override the variables at runtime.

## Problem

Centralizing env access tempts you to capture everything once at module load:

```ts
// config.ts
export const nodeEnv = z.enum(['development','test','production']).catch('development').parse(process.env.NODE_ENV)
export const isProduction = nodeEnv === 'production'
```

A value read at import time is frozen for the process, so any consumer that must observe a **runtime** change breaks:

```ts
// public-origin.ts
if (!isProduction) return requestOrigin          // load-time snapshot
throw new Error('No trusted public origin configured; ...')

// test
withEnv({ NODE_ENV: 'production' }, () => {
  assert.throws(() => getPublicOrigin('https://attacker.example'))  // FAILS
})
```

The failure is easy to misdiagnose because the constant is correct in production (where `NODE_ENV` never changes) — only a test or an in-process override exposes it. Code that read `process.env.NODE_ENV` at call time worked, so the refactor silently regressed it.

## Solution

Keep load-time constants for values genuinely fixed for the process, and expose a **call-time accessor** for anything that must observe runtime overrides:

```ts
// config.ts
export const isProduction = nodeEnv === 'production'   // deploy-time flag

/** NODE_ENV read at call time, for code that must observe runtime overrides. */
export function currentNodeEnv(): NodeEnv {
  return NODE_ENV.catch('development').parse(process.env.NODE_ENV)
}
export function isProductionEnv(): boolean {
  return currentNodeEnv() === 'production'
}
```

```ts
// public-origin.ts — safety-critical, decided per request
if (!isProductionEnv()) return requestOrigin
```

Use the same rule for string/number helpers: read on each call rather than exporting a `const` snapshot, so `withEnv(...)`-style tests keep working.

## When to Use

- A test overrides `process.env.X` (e.g. `NODE_ENV`, `PUBLIC_ORIGIN`) and a central-config refactor makes an assertion silently no-op.
- A module exports `const IS_PRODUCTION = process.env.NODE_ENV === 'production'` used in a request-time security branch.
- You are centralizing env access: snapshot genuinely fixed flags, but make anything overridable a function.
