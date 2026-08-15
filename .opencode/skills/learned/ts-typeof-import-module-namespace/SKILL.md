---
name: ts-typeof-import-module-namespace
description: "oxlint consistent-type-imports forbids typeof import(); use import type * as M + typeof M, and don't annotate with the namespace"
user-invocable: false
origin: auto-extracted
---

# TypeScript: Module Type via `import type * as` (not `typeof import()`)

**Extracted:** 2026-08-14
**Context:** Any TS file where a linter (oxlint `consistent-type-imports`) rejects `typeof import('…')` type annotations, or where you need the type of a module you load dynamically.

## Problem

Two adjacent footguns when referencing a module's type:

1. **oxlint rule `consistent-type-imports` errors** on inline `import()` type annotations:
   `type T = typeof import('./module.ts')` → "`import()` type annotations are forbidden."
2. **If you "fix" it with `import type * as M` and then write `let x: M | undefined`, tsc fails**
   with `TS2709: Cannot use namespace 'M' as a type.` A `import type * as` binding is a
   *namespace*, and a namespace is not itself a type annotation.

## Solution

Type-only namespace import + `typeof` on the namespace to get the module value type:

```typescript
import type * as AppModule from '../app/db.ts'

let appModule: typeof AppModule | undefined
```

- `import type * as` satisfies `consistent-type-imports` (no `import()` annotation).
- `typeof AppModule` (the namespace → module type) is the correct annotation, not `AppModule`.
- `import type` is **erased at runtime** — the module is NOT evaluated. Keep a separate dynamic
  `await import('../app/db.ts')` for the actual load, and put it *after* any env/module
  preconditions are set (e.g. `process.env.DATABASE_URL` in a test globalSetup) so the module
  evaluates with the right environment. Do not "simplify" the static import to a value
  `import * as` to get runtime loading — that would evaluate the module too early.

## When to Use

- A lint failure says `import()` type annotations are forbidden (oxlint `consistent-type-imports`)
- You need a module's type for a variable/param but load it dynamically (`await import()`)
- You hit `TS2709: Cannot use namespace 'X' as a type`