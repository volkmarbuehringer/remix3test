---
name: dev-gotchas
description: "Use when a TypeScript/JavaScript pattern behaves unexpectedly (async function returning void resolving early, TS7 recursive assignability flipping with module ordering, typeof import() rejected by consistent-type-imports, ES-module imports tests cannot substitute, exactOptionalPropertyTypes TS23xx errors, spread Maximum call stack size exceeded, copy-pasted multi-line object blocks, process.env snapshots breaking test overrides, narrowing lost in nested functions, as-unknown-as bridges, opt-in lint rules like consistent-return), a rate limiter blocks unexpectedly (default maxAttempts=1 breaking multi-step flows, windowMs=0 silently blocking same-ms requests), or a repo-wide format:fix (oxfmt/prettier/black/gofmt) rewrote files you never edited (classify format-only vs content by whitespace-stripped hash, revert only provably format-only files)."
user-invocable: false
origin: consolidated
---

# Dev Gotchas: TypeScript, Rate Limiter & Format Triage

Consolidated from 3 former learned skills (`typescript-gotchas`, `rate-limiter-pitfalls`, `format-fix-diff-triage`) on 2026-10-17. Reference files are namespaced under `references/<former-skill>/`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| A TS/JS pattern behaves unexpectedly — async void, TS7 assignability, exactOptionalPropertyTypes, spread overflow, env snapshots, lost narrowing, lint rules | § TypeScript | `references/typescript-gotchas/` |
| A rate limiter blocks unexpectedly — maxAttempts=1 default, windowMs=0 same-ms trap | § Rate Limiter | `references/rate-limiter-pitfalls/` |
| format:fix rewrote files you never edited — classify format-only vs content by whitespace-stripped hash before reverting | § Format Triage | `references/format-fix-diff-triage/` |

## TypeScript

_(formerly `typescript-gotchas` — references live under `references/typescript-gotchas/`)_

**Consolidated from:** `async-void-return-type-race`, `ts7-order-sensitive-type-relations`, `ts-typeof-import-module-namespace`, `mutable-executor-setter-testable-imports`, `vendor-validator-cast-audit`, `async-guard-before-await`, `js-array-spread-argument-limit`, `repeated-block-collapse-refactor`, `typescript-eventbus-bfs-async-generator`, `exact-optional-property-types-migration`, `let-narrowing-and-any-opts`, `zod-vendor-boundary-leniency`, `guarded-structural-adapter`, `lint-rule-remediation`

This skill is the **index** for TypeScript/JavaScript deltas that bite at runtime or at the lint/type boundary. For the language and compiler APIs themselves, use the official TypeScript docs; for Remix-specific type wiring, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

### Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| `await fn()` returns before the async work finishes; a utility starts an internal async IIFE but returns `void` or a cleanup/cancel function | `references/typescript-gotchas/async-void-return-type-race.md` |
| A retriggerable action (button/submit/queue-drain) sets its `busy`/`inFlight` guard after an `await`, so a double-click runs the side effect twice | `references/typescript-gotchas/async-guard-before-await.md` |
| Identical code typechecks in one file but errors (`TS2322`/`TS2345`) in another; a dependency pin bump or module reordering flips recursive assignability | `references/typescript-gotchas/ts7-order-sensitive-type-relations.md` |
| oxlint `consistent-type-imports` rejects `typeof import()`, or `TS2709: Cannot use namespace 'X' as a type` | `references/typescript-gotchas/ts-typeof-import-module-namespace.md` |
| Tests cannot substitute a top-level imported function that code captured in a closure/map (no `jest.mock`/`vi.mock`) | `references/typescript-gotchas/mutable-executor-setter-testable-imports.md` |
| Replacing a hand-rolled coercion with a vendor helper that validates/throws, or a dependency update adds runtime validation — audit `as`-cast boundaries | `references/typescript-gotchas/vendor-validator-cast-audit.md` |
| Spreading a large array (`push(...arr)`, `Math.max(...arr)`) throws `RangeError: Maximum call stack size exceeded` on a shallow call tree | `references/typescript-gotchas/array-spread-argument-limit.md` |
| The same multi-line object-literal fragment is copy-pasted across many call sites and one composite helper + spread should replace it | `references/typescript-gotchas/repeated-block-collapse-refactor.md` |
| Building a typed in-process event pipeline consumed as an async iterable (SSE/log stream) with breadth-first traversal and cycle protection | `references/typescript-gotchas/eventbus-bfs-async-generator.md` |
| `exactOptionalPropertyTypes: true` reports TS2379/TS2375/TS2345/TS2322/TS2412/TS2769 because an object literal passes `T | undefined` into `x?: T` | `references/typescript-gotchas/exact-optional-property-types.md` |
| A central-config `const` does not observe a test's runtime `process.env` override | `references/typescript-gotchas/env-snapshot-vs-call-time.md` |
| A guarded `let` is still `T | undefined` inside a nested function (forcing `x!`), or a structural interface's `opts?: any` breaks when changed to `unknown` | `references/typescript-gotchas/let-narrowing-and-any-opts.md` |
| A vendor payload validated with zod loses events: `.optional()` rejects the vendor's `null`, or one unexpected nested field fails the whole `safeParse` and the caller skips it | `references/typescript-gotchas/zod-vendor-boundary-leniency.md` |
| The same `x as unknown as VendorInterface` appears at 3+ call sites, or a vendor class is not assignable to a minimal structural interface | `references/typescript-gotchas/guarded-structural-adapter.md` |
| You enable an opt-in oxlint rule that fires on many sites and every fix must be behavior-preserving (`consistent-return` on an exhaustive `switch`, `no-array-sort`/`no-array-reverse`, `no-shadow`, `no-floating-promises`) | `references/typescript-gotchas/lint-rule-remediation.md` |

### Core Rules

**Async fire-and-forget return type race (`references/typescript-gotchas/async-void-return-type-race.md`)**

- A function that starts async work via an IIFE but returns `void` (or a cancel/cleanup function) makes `await fn()` resolve **immediately**, so everything after the await runs before the work completes — timeouts cleared early, audit logs written before errors, resources freed while still in use. Return `Promise<void>` and wrap the IIFE in `new Promise<void>((resolve) => { … resolve() })`.
- Call `resolve()` on **every** exit path (normal completion, error, abort, early return), remove/replace the cancel-function return, and update all call sites — they may need `await` added if they were not awaiting before.

**Claim the in-flight guard before the first `await` (`references/typescript-gotchas/async-guard-before-await.md`)**

- A handler that checks `if (busy) return` but assigns `busy = true` only after an `await` lets a second trigger through while the awaited I/O is in flight, running a non-idempotent action twice. Claim the guard synchronously before the first `await` and release it in `finally`; drive the control's disabled state from the same flag.
- Server `If-Match`/ETag preconditions do **not** dedupe it — the first request leaves the precondition resource unchanged, so both requests pass. Add a client-side guard (and an idempotency key for writes that are not naturally idempotent).

**TS7 order-sensitive type relations (`references/typescript-gotchas/ts7-order-sensitive-type-relations.md`)**

- TypeScript 7's native compiler evaluates deeply recursive coinductive relations (e.g. `MixinDescriptor` → `MixinRuntimeType` → `MixinReturn` → `MixInput` → `MixinDescriptor`) through an **order-sensitive** relation cache primed by module IDs (file paths, package commit-hash directory names) and the import graph: byte-identical files can compile in one place and error in another, and a pin bump with byte-identical `.d.ts` can add/remove `TS2322`/`TS2345`.
- Prove the type inputs are identical before blaming the update (same TS/tsconfig/app code/lockfile; diff every package's `.d.ts` old vs new; `package.json` `version` strings are **not** type identity) and isolate a minimal repro that resolves the real packages under both states. Fix by hitting the identity fast-path: cast to the **exact** structurally-recursive target type with `as unknown as` (a plain `as` may trip the same fragile check).

**Module type via `import type * as` (`references/typescript-gotchas/ts-typeof-import-module-namespace.md`)**

- oxlint `consistent-type-imports` forbids inline `import()` type annotations (`type T = typeof import('./module.ts')`). The fix is `import type * as M from '…'` plus `typeof M` for the annotation — **not** `M`, which is a namespace and fails with `TS2709: Cannot use namespace 'M' as a type`.
- `import type` is erased at runtime, so keep a separate dynamic `await import()` for the actual load, placed **after** env/module preconditions are set (e.g. `process.env.DATABASE_URL` in a test globalSetup). Do not "simplify" to a value `import * as` — that evaluates the module too early.

**Mutable executor setter for testable imports (`references/typescript-gotchas/mutable-executor-setter-testable-imports.md`)**

- ES module namespaces are frozen and top-level imports are captured at module-evaluation time, so tests without `jest.mock`/`vi.mock` (remix/test, `bun:test`, `node:test`) cannot substitute them. Store the dependency in a module-level mutable variable and export a setter (`__setExecutors`/`__setTestAgent`); guard an async init against clobbering the injected value with a `_ready` flag.
- The seam only works for call sites that read through it — route every handler through one resolver (a direct `mastra.getAgent(...)` bypasses it and silently runs the real dependency). Mark production-only methods optional (`?`) on the test interface and call them with `!`.

**Audit `as`-cast boundaries before adopting a validating vendor helper (`references/typescript-gotchas/vendor-validator-cast-audit.md`)**

- A hand-rolled coercion (`x === 'desc' ? 'DESC' : 'ASC'`) silently defaults on invalid input, while a vendor validator (`compileOrderByDirection`) throws — so an unchecked `as`-cast boundary turns tampered input (e.g. a hidden `_order` form field) into a 500. Read the helper first, enumerate call sites by count (`grep -rn … | wc -l`, never `| head`), classify each argument's provenance (parsed/whitelisted vs `as`-cast), and fix the **boundary once** with a runtime whitelist instead of every call site.
- The swap **relocates** rather than deletes code (N ternaries → N calls + imports): measure implementations deduplicated (`9 → 1`), not lines — type-level casts like `as 'asc' | 'desc'` cost zero runtime bytes. Add a regression test driven through the real entry point and prove it fails without the fix.

**Large-array spread argument limit (`references/typescript-gotchas/array-spread-argument-limit.md`)**

- `push(...arr)`, `arr2.push.apply(arr2, arr)`, `fn(...args)`, and `Math.max(...arr)` throw `RangeError: Maximum call stack size exceeded` past the engine's ~65,535 argument limit; the message looks like recursion even on a shallow tree. Push in a loop or use `concat` (`Promise.all(arr)` takes the array and is fine).

**Collapsing repeated blocks (`references/typescript-gotchas/repeated-block-collapse-refactor.md`)**

- Inventory the duplicated object-literal fragments by `(indent, key list)` shape before choosing `replace_all` vs a script; never truncate discovery with `| head`; prune named imports from the rewritten text (keep the trailing `\(` so `gridStateFromForm` does not shadow `gridStateFromFormData`); diff each variant shape because a composite supplies omitted keys; type the composite `| undefined`-friendly for `exactOptionalPropertyTypes`, and verify with `tsc` (spread properties are not excess-property-checked).

**Typed event bus / async-generator BFS (`references/typescript-gotchas/eventbus-bfs-async-generator.md`)**

- Typed discriminated-union events + a `Map` of handlers + an async generator that `shift()`s a FIFO queue (breadth-first) and `push()`es emitted events; guard cycles with a `maxDepth` and accept an `AbortSignal` for cancellation. Parameterize `EventHandler<T>` to avoid per-handler casts. Not for persistence/replay or strictly linear pipelines.

**`exactOptionalPropertyTypes` widening (`references/typescript-gotchas/exact-optional-property-types.md`)**

- With `exactOptionalPropertyTypes`, `{ x: T | undefined }` is no longer assignable to `{ x?: T }` (TS2379/TS2375/TS2345/TS2322/TS2412/TS2769). Widening an app-owned target to `x?: T | undefined` is **read-side-neutral** (reads already yield `T | undefined`) and fixes every call site at once. For a vendor/third-party target, guard at the call site with `...(filter !== undefined ? { filter } : {})`, never truthiness (an empty string or `0` is falsy but must pass). A derived `let` boolean does not narrow — inline the guard.

**Env: snapshot at load vs read at call time (`references/typescript-gotchas/env-snapshot-vs-call-time.md`)**

- A `config.ts` constant (`isProduction = nodeEnv === 'production'`) is frozen at import time; a test that sets `process.env.NODE_ENV = 'production'` then calls a request-time check sees the old value and the assertion silently no-ops. Keep fixed flags as constants, but expose a **call-time** accessor (`isProductionEnv()`) for anything overridable, and have `requireEnv` / `envString` / `envPositiveNumber` read on each call.

**Captured `let` narrowing and `any`-opts contravariance (`references/typescript-gotchas/let-narrowing-and-any-opts.md`)**

- Narrowing of a captured `let`/`var` is **not** preserved inside a hoisted `function` declaration (so `x!` is forced), but **is** preserved inside an arrow/function expression when the `let` is never reassigned. This repo's `remix-style/prefer-let-locals` bans local `const`, so bind a fresh never-reassigned `let` after the guard for inline closures; for hoisted declarations keep `!`, pass the value as a parameter, or convert to an arrow.
- Replacing a load-bearing `opts?: any` with `unknown` in a structural interface fails because parameters are checked contravariantly — neither the vendor class's concrete options type nor narrower test doubles are assignable to `unknown`. Keep `any` with its documented disable, or move the cast to one app-owned adapter; do not "fix" it to `unknown`.

**Lenient zod schemas at vendor boundaries (`references/typescript-gotchas/zod-vendor-boundary-leniency.md`)**

- `.optional()` rejects `null`, but vendors often serialize "absent" as `null` — use `.nullish()` for those fields (and their nested fields). If the value is additionally wrapped in `.catch(undefined)`, a top-level null silently becomes `undefined` and the consumer never sees the event.
- Add `.catch(undefined)` to each field so one unexpected nested type degrades instead of failing the whole `safeParse`; let only the envelope discriminator be able to fail. When failure is handled by skipping, prove the skip cannot drop a terminal event.

**Guarded structural adapter (`references/typescript-gotchas/guarded-structural-adapter.md`)**

- When a vendor class is not assignable to a minimal app-owned interface (contravariant method params) and `x as unknown as Interface` repeats at 3+ call sites, export one `toInterface(value: unknown): Interface` that `typeof`-checks the members the app calls and throws otherwise; keep the single cast inside, after the guard.

**Behavior-preserving fixes for opt-in lint rules (`references/typescript-gotchas/lint-rule-remediation.md`)**

- Enable the rule, not its category; scope it to `**/*.{ts,tsx,js,jsx}` so vendored `.mjs` is skipped. `consistent-return` on an exhaustive union `switch` is a false positive versus `tsc` — turn the final `case` into `default:` (or `default: return null` in render maps) instead of inventing a fallback; a `process.exit(1)` path becomes `return process.exit(1)` under `allowUnreachableCode: false`. `toSorted()`/`toReversed()` are safe only on a fresh array; `void expr` is runtime-identical and is `--fix-suggestions` output.

### When to Use

- A TypeScript/JavaScript behavior is surprising: an await returns too early, a recursive type check flips with ordering, a type-import lint rule fights the annotation you need, a test cannot control an imported dependency, or a vendor helper now throws where a coercion used to default.
- You are writing or reviewing async "pump"/stream utilities, diagnosing flaky TS7 compile errors, or migrating a codebase to stricter type-import and runtime-validation rules.
- Before swapping a ternary/coercion for a vendor `compile*`/`parse*`/`assert*` helper, or after a dependency bump changes validation behavior.
- A user-triggerable async action can run twice (double-click, Enter-repeat, two tabs) and performs a non-idempotent write — see `references/typescript-gotchas/async-guard-before-await.md`.
- A shallow call tree throws `Maximum call stack size exceeded` — suspect a large-array spread/`apply` before recursion depth.
- A repetitive bulk refactor copies the same multi-line object fragment across many call sites.
- You are building an in-process typed event pipeline consumed as a stream.
- You enable `exactOptionalPropertyTypes` (or a dependency bump starts passing `T | undefined` into an `x?: T`) and see TS2379/TS2375/TS2345/TS2322/TS2412/TS2769 — see `references/typescript-gotchas/exact-optional-property-types.md`.
- A central config's `const` does not observe a test's runtime `process.env` override, or a request-time decision reads a stale snapshot.
- A guard narrows a value but a nested helper still requires `!`, or replacing `any` with `unknown` in a structural interface stops the vendor class / test doubles from typechecking.
- A zod schema at a vendor/stream boundary silently loses events — suspect `.optional()` rejecting the vendor's `null`, or a single bad field failing the whole parse.
- The same `as unknown as VendorInterface` cast is repeated across call sites and should collapse into one runtime-checked adapter.
- You are enabling an opt-in oxlint/ESLint rule and need fixes that do not change runtime behavior (`consistent-return` flagging an exhaustive `switch`, `no-array-sort`/`no-shadow`/`no-floating-promises`).

### Related Skills

- `remix3-ui § Frames` — the frame/theme host-binding context that hits the TS7 order-sensitive `MixinDescriptor` relation
- `remix3-tooling § Build & Tooling` (`references/remix3-build-and-tooling/upstream-dependency-analysis.md`) — deciding whether a branch-pinned dependency update's new runtime validation affects your project
- `remix3-tooling § Testing` — Remix 3 test-suite patterns that consume the mutable-setter import seam
- `remix3-ui § Client Entries` — the Remix 3 clientEntry handler / pending-state context where this re-entrancy bug is most often written

---

## Rate Limiter

_(formerly `rate-limiter-pitfalls` — references live under `references/rate-limiter-pitfalls/`)_

**Consolidated from:** `rate-limiter-maxattempts-default`, `rate-limiter-window-ms-zero-trap`

Covers two common traps when using `createRateLimiter` from `app/utils/rate-limiter.ts`:
1. Default `maxAttempts=1` blocks follow-up requests in multi-step flows
2. `windowMs <= 0` silently blocks same-ms requests

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A follow-up request in a multi-step flow getting silently blocked (`maxAttempts` default) | `references/rate-limiter-pitfalls/maxattempts-default.md` |
| Dev/test disabling the limiter with `windowMs=0` and same-millisecond requests still getting blocked | `references/rate-limiter-pitfalls/window-ms-zero-trap.md` |

### Core Rules

- **`createRateLimiter` (from `app/utils/rate-limiter.ts`) defaults to `maxAttempts: 1`** — only **one** request per window, so the follow-up request of a multi-step flow (initial request → user responds → follow-up within the same window) is silently blocked. Always set `maxAttempts` explicitly when you expect more than one request per window.
- **Size `maxAttempts` from the request waterfall**: count the expected requests (e.g. initial + answer + tool decision = at least 3; the worked example uses 5).
- **Set `perKey: true` (per-IP) or `perUser: true`** so one user cannot starve another.
- **`windowMs <= 0` silently blocks same-ms requests**: `entryCount` tests `Date.now() - entry.firstAt > windowMs`; with `windowMs=0` two same-millisecond requests give `diff = 0`, which is **not** `> 0`, so the entry never expires and the second request is falsely rate-limited.
- **Guard the disabled case with an early return**: when `windowMs <= 0`, return a limiter whose `check`/`set`/`attempt`/`state`/`reset` short-circuit (allow everything) before any window logic runs.
- **Detection signals**: sequential tests calling the same rate-limited action fail non-deterministically; "Too many requests" errors appear in dev/test when `windowMs=0`; tests only pass with arbitrary `setTimeout(5)` workarounds.

### When to Use

- Adding a rate limiter to any endpoint that is part of a multi-step request flow
- Debugging 429 responses that appear only sometimes during normal user workflows
- Setting `windowMs=0` in dev/test to disable rate limiting
- You see "Too many requests" errors but only on the second of two rapid requests

---

## Format Triage

_(formerly `format-fix-diff-triage` — references live under `references/format-fix-diff-triage/`)_

**Extracted:** 2026-10-05

**Context:** A session ran the repo-blessed `npm run format:fix` to normalize its own edits. The formatter rewrote ~25 files the session never touched — the committed baseline itself was not formatter-clean — while the working tree simultaneously held the user's own uncommitted work (feature edits, a dependency bump). The goal: keep the session diff focused without reverting anyone else's changes.

### Problem

- `git status` cannot distinguish "dirtied by my formatter run" from "dirty before the session started" — there is no snapshot of session start.
- You must not blanket-revert unrelated files: some contain pre-existing content edits, and `git checkout --` would destroy work you did not do.
- `git diff -w` / `--ignore-all-space` misclassifies: re-wrapping changes line breaks, and the formatter often **adds trailing commas**, which are non-whitespace tokens — so real reformat-only files still show as content changes.

### Solution

Compare each unrelated file against HEAD with **all whitespace stripped** — reflow is then invisible; only token changes survive:

```bash
for f in $(git diff --name-only); do
  case "$f" in <files-you-actually-edited>) continue ;; esac
  a=$(git show "HEAD:$f" | tr -d '[:space:]' | md5sum | cut -d' ' -f1)
  b=$(tr -d '[:space:]' < "$f" | md5sum | cut -d' ' -f1)
  if [ "$a" = "$b" ]; then echo "FORMAT-ONLY: $f"; else echo "CONTENT:     $f"; fi
done
```

- **FORMAT-ONLY** → token content identical to HEAD → safe: `git checkout -- "$f"`.
- **CONTENT** → leave it. It either holds pre-existing edits *or* is formatting that added trailing commas/semicolons. The classifier has **no false negatives** (commas count as content), so its only error mode is keeping harmless noise — the safe direction. Never revert a CONTENT file to "clean up" a diff.
- Afterwards re-verify once (`npm run typecheck` / build): the reverted files are provably whitespace-identical, so one check settles it.

Prevention and companion traps:

- Prefer the scoped formatter over the repo-wide one once a dirty baseline is discovered: `npx oxfmt <your-files> --write` (or `npx prettier --write <files>`, `black <files>`, `gofmt -w <files>`). A repo-wide run only makes sense if the baseline is formatter-clean to begin with.
- If a new file you created is imported by your modified files, it shows as `??` in `git status`; `git add` of just the modified files yields a broken tree in CI. Stage every `??` file your change introduced together with the edits.
- Keep an explicit list of the files your session actually edited — it is the `case` allowlist above and the source of truth for what belongs in the commit message.

### When to Use

- After a repo-wide format run, `git status` lists files outside your edit set.
- Asked to "revert the formatter noise" on a tree that also contains someone's uncommitted work.
- Before committing from a shared/dirty working tree, to separate your change from the baseline.
