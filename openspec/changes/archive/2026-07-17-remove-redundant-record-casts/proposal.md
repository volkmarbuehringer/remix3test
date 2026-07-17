## Why

Five `as Record<string, string>` casts in `resources/controller.tsx` (lines 253, 315, 401) and `offering-configs/controller.tsx` (lines 305, 520) suppress the type system. The inferred type from `ParsedFormData<typeof resourceSaveSchema>` is already a subtype of `Record<string, string>` — the casts add noise and hide future type mismatches (e.g., if a schema field changes to `coerce.number()`).

This is a code quality follow-up to the `parse-safe-consistency` spec, which requires `parseSafe` with proper discriminated-union handling. The casts partially defeat the type safety that pattern provides.

## What Changes

- `resources/controller.tsx`: Remove cast in `create` action, `update` action, and `destroy` ternary
- `offering-configs/controller.tsx`: Remove two casts after `parseSafe` guards
- Let TypeScript infer the precise `ParsedFormData<typeof resourceSaveSchema>` type instead

No runtime behavior changes. The inferred type is structurally identical to `Record<string, string>` for the current schema.

## Capabilities

### New Capabilities

- *(none — this is a code quality fix, not a new capability)*

### Modified Capabilities

- `parse-safe-consistency`: Adds an implicit requirement that `parseSafe` result values use the inferred type rather than a widened cast. No spec-level behavior change — the casts are an implementation detail.

## Impact

- `app/actions/verwaltung/resources/controller.tsx` — 4 cast removals (incl. agent branch)
- `app/actions/verwaltung/offering-configs/controller.tsx` — 2 cast removals
- No API, dependency, or test changes expected (types are structurally identical)
