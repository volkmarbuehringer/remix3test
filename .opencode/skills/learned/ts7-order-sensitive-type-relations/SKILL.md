---
name: ts7-order-sensitive-type-relations
description: "TS7 recursive assignability flips on module ordering — verify identical inputs, then fix with exact-type (as unknown as) casts"
user-invocable: false
origin: auto-extracted
---

# TypeScript 7 Order-Sensitive Type Relations

**Extracted:** 2026-08-14
**Context:** A TypeScript 7.x (native/Go compiler, e.g. 7.0.2) project where identical code typechecks in some files but errors in others, or a dependency pin bump (even with byte-identical `.d.ts`) flips previously-passing expressions to `TS2322`/`TS2345`.

## Problem
The native TS7 compiler evaluates deeply recursive coinductive type relations (e.g. `MixinDescriptor` → `MixinRuntimeType` → `MixinReturn` → `MixInput` → `MixinDescriptor`). The pass/fail outcome of these assignability checks is **order-sensitive**: it depends on internal relation-cache priming, which is influenced by module IDs (file paths, package commit-hash directory names) and the import graph.

Symptoms:
- Byte-identical copies of the same file: one compiles clean, the other errors.
- A dependency pin bump whose `*.d.ts` are byte-identical still adds/removes errors.
- A minimal repro of the failing expression fails even in isolation under BOTH the old and new dependency states — so the packages are not the cause.
- `MixinDescriptor<Element, [styles], ...>` is rejected where `MixinDescriptor<HTMLButtonElement, any, ...>` is expected in one file, but the same comparison passes in another (symmetric hosts: `css()` on `<div>` passes while the same `css()` on `<button>` errors).

## Solution
1. **Prove the type inputs are identical** before blaming the update:
   - Same TypeScript version, tsconfig, app code, and lockfile (all non-remix deps identical) — confirm via lockfile diff.
   - Diff every package's `.d.ts` old vs new: `diff -rq oldX newX | grep "\.d\.ts"` (a regex/glob loop over package dirs can silently miss diffs — verify with a known-different file).
   - package.json `version` strings are **not** part of type identity: bumping/reverting them changes nothing. Ignore version diffs.
   - Only runtime `.js`/`.js.map`/`src/` and `package.json` version differing ⇒ the type-checking inputs are identical ⇒ the error is compiler ordering, not a real type change.
2. **Isolate with a minimal repro** that resolves the real packages (symlink the project's `node_modules`), run under both dependency states, and confirm the isolated behavior is identical.
3. **Fix by making the comparison hit the identity fast-path.** Cast the value to the **exact** structurally-recursive target type (`args = any`, exact `node`) so the check becomes trivial instead of recursive:

```ts
import type { MixinDescriptor, ElementProps } from 'remix/ui'

type ButtonStyle = MixinDescriptor<HTMLButtonElement, any, ElementProps>

function buttonStyle(style: CSSMixinDescriptor): ButtonStyle {
  return style as unknown as ButtonStyle
}
```

A plain `as` may trip the same fragile check; use `as unknown as`. After casting, the expression matches the host's expected type exactly and passes deterministically, independent of module ordering.

## When to Use
- `TS2322`/`TS2345` involving a recursive/conditional/derived type appears in some files but not others with identical code.
- A dependency bump — even a type-identical one — adds or removes such errors.
- The compiler is TypeScript 7.x (native; API lives at `typescript/unstable/sync`; plain `require('typescript')` returns only a version shim).
