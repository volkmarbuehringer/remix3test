---
name: typescript-gotchas
description: "Use when a TypeScript/JavaScript pattern behaves unexpectedly — an async function returning void resolves before its work completes, TS7 recursive assignability flipping with module ordering, `typeof import()` rejected by `consistent-type-imports`, ES-module imports that tests cannot substitute, a vendor validator that validates or throws where a hand-rolled coercion used to be, a re-entrant async action sets its `busy`/`inFlight` guard after an `await` so a double-click duplicates the write, spreading a large array throws `Maximum call stack size exceeded`, the same multi-line object block is copy-pasted across many call sites, or `exactOptionalPropertyTypes: true` reports TS2379/TS2375/TS2345/TS2322/TS2412/TS2769 because an object passes `T | undefined` into an `x?: T`, or a central config snapshots `process.env` at module load so a test that overrides it at runtime silently stops taking effect."
user-invocable: false
origin: consolidated
---

# TypeScript Gotchas

**Consolidated from:** `async-void-return-type-race`, `ts7-order-sensitive-type-relations`, `ts-typeof-import-module-namespace`, `mutable-executor-setter-testable-imports`, `vendor-validator-cast-audit`, `async-guard-before-await`, `js-array-spread-argument-limit`, `repeated-block-collapse-refactor`, `typescript-eventbus-bfs-async-generator`, `exact-optional-property-types-migration`

This skill is the **index** for TypeScript/JavaScript deltas that bite at runtime or at the lint/type boundary. For the language and compiler APIs themselves, use the official TypeScript docs; for Remix-specific type wiring, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

## Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| `await fn()` returns before the async work finishes; a utility starts an internal async IIFE but returns `void` or a cleanup/cancel function | `references/async-void-return-type-race.md` |
| A retriggerable action (button/submit/queue-drain) sets its `busy`/`inFlight` guard after an `await`, so a double-click runs the side effect twice | `references/async-guard-before-await.md` |
| Identical code typechecks in one file but errors (`TS2322`/`TS2345`) in another; a dependency pin bump or module reordering flips recursive assignability | `references/ts7-order-sensitive-type-relations.md` |
| oxlint `consistent-type-imports` rejects `typeof import()`, or `TS2709: Cannot use namespace 'X' as a type` | `references/ts-typeof-import-module-namespace.md` |
| Tests cannot substitute a top-level imported function that code captured in a closure/map (no `jest.mock`/`vi.mock`) | `references/mutable-executor-setter-testable-imports.md` |
| Replacing a hand-rolled coercion with a vendor helper that validates/throws, or a dependency update adds runtime validation — audit `as`-cast boundaries | `references/vendor-validator-cast-audit.md` |
| Spreading a large array (`push(...arr)`, `Math.max(...arr)`) throws `RangeError: Maximum call stack size exceeded` on a shallow call tree | `references/array-spread-argument-limit.md` |
| The same multi-line object-literal fragment is copy-pasted across many call sites and one composite helper + spread should replace it | `references/repeated-block-collapse-refactor.md` |
| Building a typed in-process event pipeline consumed as an async iterable (SSE/log stream) with breadth-first traversal and cycle protection | `references/eventbus-bfs-async-generator.md` |
| `exactOptionalPropertyTypes: true` reports TS2379/TS2375/TS2345/TS2322/TS2412/TS2769 because an object literal passes `T | undefined` into `x?: T` | `references/exact-optional-property-types.md` |
| A central-config `const` does not observe a test's runtime `process.env` override | `references/env-snapshot-vs-call-time.md` |

## Core Rules

**Async fire-and-forget return type race (`references/async-void-return-type-race.md`)**

- A function that starts async work via an IIFE but returns `void` (or a cancel/cleanup function) makes `await fn()` resolve **immediately**, so everything after the await runs before the work completes — timeouts cleared early, audit logs written before errors, resources freed while still in use. Return `Promise<void>` and wrap the IIFE in `new Promise<void>((resolve) => { … resolve() })`.
- Call `resolve()` on **every** exit path (normal completion, error, abort, early return), remove/replace the cancel-function return, and update all call sites — they may need `await` added if they were not awaiting before.

**Claim the in-flight guard before the first `await` (`references/async-guard-before-await.md`)**

- A handler that checks `if (busy) return` but assigns `busy = true` only after an `await` lets a second trigger through while the awaited I/O is in flight, running a non-idempotent action twice. Claim the guard synchronously before the first `await` and release it in `finally`; drive the control's disabled state from the same flag.
- Server `If-Match`/ETag preconditions do **not** dedupe it — the first request leaves the precondition resource unchanged, so both requests pass. Add a client-side guard (and an idempotency key for writes that are not naturally idempotent).

**TS7 order-sensitive type relations (`references/ts7-order-sensitive-type-relations.md`)**

- TypeScript 7's native compiler evaluates deeply recursive coinductive relations (e.g. `MixinDescriptor` → `MixinRuntimeType` → `MixinReturn` → `MixInput` → `MixinDescriptor`) through an **order-sensitive** relation cache primed by module IDs (file paths, package commit-hash directory names) and the import graph: byte-identical files can compile in one place and error in another, and a pin bump with byte-identical `.d.ts` can add/remove `TS2322`/`TS2345`.
- Prove the type inputs are identical before blaming the update (same TS/tsconfig/app code/lockfile; diff every package's `.d.ts` old vs new; `package.json` `version` strings are **not** type identity) and isolate a minimal repro that resolves the real packages under both states. Fix by hitting the identity fast-path: cast to the **exact** structurally-recursive target type with `as unknown as` (a plain `as` may trip the same fragile check).

**Module type via `import type * as` (`references/ts-typeof-import-module-namespace.md`)**

- oxlint `consistent-type-imports` forbids inline `import()` type annotations (`type T = typeof import('./module.ts')`). The fix is `import type * as M from '…'` plus `typeof M` for the annotation — **not** `M`, which is a namespace and fails with `TS2709: Cannot use namespace 'M' as a type`.
- `import type` is erased at runtime, so keep a separate dynamic `await import()` for the actual load, placed **after** env/module preconditions are set (e.g. `process.env.DATABASE_URL` in a test globalSetup). Do not "simplify" to a value `import * as` — that evaluates the module too early.

**Mutable executor setter for testable imports (`references/mutable-executor-setter-testable-imports.md`)**

- ES module namespaces are frozen and top-level imports are captured at module-evaluation time, so tests without `jest.mock`/`vi.mock` (remix/test, `bun:test`, `node:test`) cannot substitute them. Store the dependency in a module-level mutable variable and export a setter (`__setExecutors`/`__setTestAgent`); guard an async init against clobbering the injected value with a `_ready` flag.
- The seam only works for call sites that read through it — route every handler through one resolver (a direct `mastra.getAgent(...)` bypasses it and silently runs the real dependency). Mark production-only methods optional (`?`) on the test interface and call them with `!`.

**Audit `as`-cast boundaries before adopting a validating vendor helper (`references/vendor-validator-cast-audit.md`)**

- A hand-rolled coercion (`x === 'desc' ? 'DESC' : 'ASC'`) silently defaults on invalid input, while a vendor validator (`compileOrderByDirection`) throws — so an unchecked `as`-cast boundary turns tampered input (e.g. a hidden `_order` form field) into a 500. Read the helper first, enumerate call sites by count (`grep -rn … | wc -l`, never `| head`), classify each argument's provenance (parsed/whitelisted vs `as`-cast), and fix the **boundary once** with a runtime whitelist instead of every call site.
- The swap **relocates** rather than deletes code (N ternaries → N calls + imports): measure implementations deduplicated (`9 → 1`), not lines — type-level casts like `as 'asc' | 'desc'` cost zero runtime bytes. Add a regression test driven through the real entry point and prove it fails without the fix.

**Large-array spread argument limit (`references/array-spread-argument-limit.md`)**

- `push(...arr)`, `arr2.push.apply(arr2, arr)`, `fn(...args)`, and `Math.max(...arr)` throw `RangeError: Maximum call stack size exceeded` past the engine's ~65,535 argument limit; the message looks like recursion even on a shallow tree. Push in a loop or use `concat` (`Promise.all(arr)` takes the array and is fine).

**Collapsing repeated blocks (`references/repeated-block-collapse-refactor.md`)**

- Inventory the duplicated object-literal fragments by `(indent, key list)` shape before choosing `replace_all` vs a script; never truncate discovery with `| head`; prune named imports from the rewritten text (keep the trailing `\(` so `gridStateFromForm` does not shadow `gridStateFromFormData`); diff each variant shape because a composite supplies omitted keys; type the composite `| undefined`-friendly for `exactOptionalPropertyTypes`, and verify with `tsc` (spread properties are not excess-property-checked).

**Typed event bus / async-generator BFS (`references/eventbus-bfs-async-generator.md`)**

- Typed discriminated-union events + a `Map` of handlers + an async generator that `shift()`s a FIFO queue (breadth-first) and `push()`es emitted events; guard cycles with a `maxDepth` and accept an `AbortSignal` for cancellation. Parameterize `EventHandler<T>` to avoid per-handler casts. Not for persistence/replay or strictly linear pipelines.

**`exactOptionalPropertyTypes` widening (`references/exact-optional-property-types.md`)**

- With `exactOptionalPropertyTypes`, `{ x: T | undefined }` is no longer assignable to `{ x?: T }` (TS2379/TS2375/TS2345/TS2322/TS2412/TS2769). Widening an app-owned target to `x?: T | undefined` is **read-side-neutral** (reads already yield `T | undefined`) and fixes every call site at once. For a vendor/third-party target, guard at the call site with `...(filter !== undefined ? { filter } : {})`, never truthiness (an empty string or `0` is falsy but must pass). A derived `let` boolean does not narrow — inline the guard.

**Env: snapshot at load vs read at call time (`references/env-snapshot-vs-call-time.md`)**

- A `config.ts` constant (`isProduction = nodeEnv === 'production'`) is frozen at import time; a test that sets `process.env.NODE_ENV = 'production'` then calls a request-time check sees the old value and the assertion silently no-ops. Keep fixed flags as constants, but expose a **call-time** accessor (`isProductionEnv()`) for anything overridable, and have `requireEnv` / `envString` / `envPositiveNumber` read on each call.

## When to Use

- A TypeScript/JavaScript behavior is surprising: an await returns too early, a recursive type check flips with ordering, a type-import lint rule fights the annotation you need, a test cannot control an imported dependency, or a vendor helper now throws where a coercion used to default.
- You are writing or reviewing async "pump"/stream utilities, diagnosing flaky TS7 compile errors, or migrating a codebase to stricter type-import and runtime-validation rules.
- Before swapping a ternary/coercion for a vendor `compile*`/`parse*`/`assert*` helper, or after a dependency bump changes validation behavior.
- A user-triggerable async action can run twice (double-click, Enter-repeat, two tabs) and performs a non-idempotent write — see `references/async-guard-before-await.md`.
- A shallow call tree throws `Maximum call stack size exceeded` — suspect a large-array spread/`apply` before recursion depth.
- A repetitive bulk refactor copies the same multi-line object fragment across many call sites.
- You are building an in-process typed event pipeline consumed as a stream.
- You enable `exactOptionalPropertyTypes` (or a dependency bump starts passing `T | undefined` into an `x?: T`) and see TS2379/TS2375/TS2345/TS2322/TS2412/TS2769 — see `references/exact-optional-property-types.md`.
- A central config's `const` does not observe a test's runtime `process.env` override, or a request-time decision reads a stale snapshot.

## Related Skills

- `remix3-frame-cliententry` — the frame/theme host-binding context that hits the TS7 order-sensitive `MixinDescriptor` relation
- `remix3-build-and-tooling` (`references/upstream-dependency-analysis.md`) — deciding whether a branch-pinned dependency update's new runtime validation affects your project
- `remix3-testing` — Remix 3 test-suite patterns that consume the mutable-setter import seam
- `remix3-client-entries` — the Remix 3 clientEntry handler / pending-state context where this re-entrancy bug is most often written
