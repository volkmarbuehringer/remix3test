---
name: typescript-gotchas
description: "Use when a TypeScript/JavaScript pattern behaves unexpectedly — an async function returning void resolves before its work completes, TS7 recursive assignability flipping with module ordering, `typeof import()` rejected by `consistent-type-imports`, ES-module imports that tests cannot substitute, or a vendor validator that validates or throws where a hand-rolled coercion used to be."
user-invocable: false
origin: consolidated
---

# TypeScript Gotchas

**Consolidated from:** `async-void-return-type-race`, `ts7-order-sensitive-type-relations`, `ts-typeof-import-module-namespace`, `mutable-executor-setter-testable-imports`, `vendor-validator-cast-audit`

This skill is the **index** for TypeScript/JavaScript deltas that bite at runtime or at the lint/type boundary. For the language and compiler APIs themselves, use the official TypeScript docs; for Remix-specific type wiring, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

## Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| `await fn()` returns before the async work finishes; a utility starts an internal async IIFE but returns `void` or a cleanup/cancel function | `references/async-void-return-type-race.md` |
| Identical code typechecks in one file but errors (`TS2322`/`TS2345`) in another; a dependency pin bump or module reordering flips recursive assignability | `references/ts7-order-sensitive-type-relations.md` |
| oxlint `consistent-type-imports` rejects `typeof import()`, or `TS2709: Cannot use namespace 'X' as a type` | `references/ts-typeof-import-module-namespace.md` |
| Tests cannot substitute a top-level imported function that code captured in a closure/map (no `jest.mock`/`vi.mock`) | `references/mutable-executor-setter-testable-imports.md` |
| Replacing a hand-rolled coercion with a vendor helper that validates/throws, or a dependency update adds runtime validation — audit `as`-cast boundaries | `references/vendor-validator-cast-audit.md` |

## Core Rules

**Async fire-and-forget return type race (`references/async-void-return-type-race.md`)**

- A function that starts async work via an IIFE but returns `void` (or a cancel/cleanup function) makes `await fn()` resolve **immediately**, so everything after the await runs before the work completes — timeouts cleared early, audit logs written before errors, resources freed while still in use. Return `Promise<void>` and wrap the IIFE in `new Promise<void>((resolve) => { … resolve() })`.
- Call `resolve()` on **every** exit path (normal completion, error, abort, early return), remove/replace the cancel-function return, and update all call sites — they may need `await` added if they were not awaiting before.

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

## When to Use

- A TypeScript/JavaScript behavior is surprising: an await returns too early, a recursive type check flips with ordering, a type-import lint rule fights the annotation you need, a test cannot control an imported dependency, or a vendor helper now throws where a coercion used to default.
- You are writing or reviewing async "pump"/stream utilities, diagnosing flaky TS7 compile errors, or migrating a codebase to stricter type-import and runtime-validation rules.
- Before swapping a ternary/coercion for a vendor `compile*`/`parse*`/`assert*` helper, or after a dependency bump changes validation behavior.

## Related Skills

- `exact-optional-property-types-migration` — the other TypeScript compiler-flag gotcha cluster (`exactOptionalPropertyTypes` errors and widening optional targets)
- `typescript-eventbus-bfs-async-generator` — typed event bus / async-generator patterns where the async-return race and recursive types recur
- `remix3-frame-cliententry` — the frame/theme host-binding context that hits the TS7 order-sensitive `MixinDescriptor` relation
- `remix-upstream-dependency-analysis` — deciding whether a branch-pinned dependency update's new runtime validation affects your project
- `repeated-block-collapse-refactor` — the composite-helper refactor that the vendor-validator swap's line accounting points at
- `remix3-testing` — Remix 3 test-suite patterns that consume the mutable-setter import seam
