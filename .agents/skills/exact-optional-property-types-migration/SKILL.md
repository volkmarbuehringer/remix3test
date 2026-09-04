---
name: exact-optional-property-types-migration
description: "Use when TypeScript reports TS2379/TS2375/TS2345/TS2322/TS2412/TS2769 with 'exactOptionalPropertyTypes: true', or when enabling that flag causes object literals passing `T | undefined` into `x?: T` — widen the target optional type to `| undefined` (read-side-neutral), using `!== undefined` conditional spreads for vendor targets"
metadata:
  origin: auto-extracted
---

# Enabling exactOptionalPropertyTypes Without Breakage

**Extracted:** 2026-09-04
**Context:** Migrating a TypeScript codebase to the `exactOptionalPropertyTypes` compiler flag (part of a stricter-TS adoption).

## Problem

`exactOptionalPropertyTypes` changes optional-property assignability so `{ x: T | undefined }` is NO LONGER assignable to `{ x?: T }`. Enabling it typically produces hundreds of errors:

```
error TS2379: Argument of type '{ offset: number; filter: string | undefined; ... }'
  is not assignable to parameter of type '{ offset: number; filter?: string; ... }'
  with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types
  of the target's properties.
```

Common codes: TS2379 (argument not assignable), TS2375 (object not assignable to a named type/component props), TS2345, TS2322, TS2412 (interface/class property override), TS2769 (overload).

## Solution — read-side-neutral widening

The key insight: widening `x?: T` to `x?: T | undefined` is **read-side-neutral**. Reading an optional property already yields `T | undefined`, so widening only loosens what is *assignable on the write side*; it never changes what *readers receive*. Therefore it is behavior-safe and cannot break existing consumers.

**Primary fix — target type is app-owned:** widen the target optional property.

```ts
// before
type Opts = { offset: number; filter?: string; pageSize: number }
// after
type Opts = { offset: number; filter?: string | undefined; pageSize: number }
```

For component prop interfaces (e.g. `XxxPageProps { filter?: string }`), widen the interface — one edit fixes every call site.

**Vendor / third-party target (cannot edit the type):** fix at the call site by only including the property when defined. Use `!== undefined`, NOT truthiness (an empty string or `0` is falsy but must still be passed).

```ts
return { offset, pageSize, ...(filter !== undefined ? { filter } : {}) }
```

**TS2412 (property override):** widen the overridden property to `| undefined`.
**TS2769 (overload):** add/adjust an overload (or widen the param) to accept `| undefined`.

The compiler's own text suggests this: "Consider adding 'undefined' to the types of the target's properties."

## When to Use

- Enabling `exactOptionalPropertyTypes` and seeing the codes above.
- An object literal or return value passes `X | undefined` into a target whose prop is `X?`.
- A grid/query "filter" (`URLSearchParams.get(...)` → `string | null`) flows into an optional `filter?: string`.

## Pitfall: vendor-assignability boundaries

If the target you'd widen is actually the app-typed parameter of a method a vendor object must be assignable to (e.g. an adapter interface the real Mastra `Agent` implements), do NOT change a method's `opts?: any` to `opts?: Record<string, unknown>` or `unknown`. Function params are contravariant: a vendor method accepting a narrower options type stops being assignable to `(opts?: Record<string, unknown>)`. Only `any` (or the exact vendor type) survives — keep `any` with a justified `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.
