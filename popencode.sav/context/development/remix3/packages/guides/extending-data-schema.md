<!-- Context: development/remix3/packages/guides | Priority: normal | Version: 1.0 | Updated: 2026-05-20 -->

# Guide: Extending Data Schema

**Purpose**: Build custom schemas with `createSchema()`, `createIssue()`, and `fail()`.

## Core API

### `createSchema(validator)` — build any custom schema

The validator receives `(value, context)` and must return `{ value }` on success or `{ issues: [...] }` on failure. The returned object is a full Standard Schema v1 compatible chainable schema (`.pipe()`, `.refine()`, `.transform()` work automatically).

```ts
import { createSchema, createIssue, fail } from 'remix/data-schema'
import type { Schema } from 'remix/data-schema'
```

**Validation context**:
- `context.path` — current property path (e.g. `['user', 'email']`)
- `context.options` — parse options passed to `parse()` / `parseSafe()`

### `createIssue(message, path?)` — single issue object

```ts
createIssue('Must be positive', ['age'])
// → { message: 'Must be positive', path: ['age'] }
```

### `fail(message, path?, options?)` — return a failure result (one issue)

Shorthand for `{ issues: [createIssue(...)] }`. Also accepts optional `{ code, values, input, parseOptions }` for error-map integration:

```ts
fail('Expected number', ['age'], { code: 'type.number', input: value, parseOptions: opts })
```

## Example 1: `trimmedString()` — validates + transforms

```ts
function trimmedString(): Schema<unknown, string> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'string') {
      return fail('Expected string', context.path)
    }
    return { value: value.trim() }
  })
}

let s = parse(trimmedString(), '  hello  ') // → 'hello'
```

The output `Schema` is chainable — `.pipe()`, `.refine()`, `.transform()` all work out of the box on the custom schema because `createSchema` wraps it into the same internal machinery.

## Example 2: `latLng()` — validates a coordinate pair

```ts
type LatLng = { lat: number; lng: number }

function latLng(): Schema<unknown, LatLng> {
  return createSchema(function validate(value, context) {
    if (typeof value !== 'object' || value === null) {
      return fail('Expected object', context.path)
    }
    let input = value as Record<string, unknown>
    if (typeof input.lat !== 'number' || typeof input.lng !== 'number') {
      return fail('Expected { lat: number; lng: number }', context.path)
    }
    return { value: { lat: input.lat, lng: input.lng } }
  })
}
```

## Minimal issue helpers — extract from the same module

```ts
import { createSchema, createIssue, fail } from 'remix/data-schema'
```

Use `createIssue` when building multi-issue results; use `fail` as a one-liner for single-issue failures. Both produce Standard Schema v1 compliant issue objects.

**Reference**: `~/remix/packages/data-schema/src/lib/schema.ts` (lines 149–241 for `createSchema`)

**Related**: `concepts/data-schema.md`, `concepts/form-data-parsing.md`
