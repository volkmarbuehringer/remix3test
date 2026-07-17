## Context

`resources/controller.tsx` and `offering-configs/controller.tsx` use `f.object()` to define their schemas, which produces an inferred type `ParsedFormData<typeof resourceSaveSchema>` — a precise object type with string-valued fields. Three locations cast `result.value` to `Record<string, string>` after a `parseSafe()` guard, which widens the type unnecessarily.

## Goals / Non-Goals

**Goals:**
- Remove all three `as Record<string, string>` casts
- Let TypeScript infer the precise schema-derived type

**Non-Goals:**
- No runtime behavior changes
- No schema changes
- No changes to `gridStateFromForm()` or other consuming functions

## Decisions

**Remove casts directly — no abstraction needed.**
The `if (!result.success) { return ... }` guard already narrows `result` to the success branch. The inferred type is a subtype of `Record<string, string>`, so all downstream consumers (`.trim()`, `gridStateFromForm()`) accept it without changes.

The `destroy` action uses a ternary with a fallback object:
```ts
let parsed = (
  result.success ? result.value : { description: '', _offset: '', ... }
) as Record<string, string>
```
The fallback object has the same keys as the schema. TypeScript infers both branches to the identical shape, so the cast is equally redundant here.

## Risks / Trade-offs

- **Zero risk** — the inferred type `{ name: string; description: string; capabilities: string; _offset: string; _sort: string; _order: string; _filter: string }` is structurally `Record<string, string>`. Every consumer gets the same values.
- If a future schema change adds a non-string field (e.g., `coerce.number()`), the removed cast would surface a type error at the cast site — that's the *desired* behavior, not a risk.
