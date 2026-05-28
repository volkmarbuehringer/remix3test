# Concept: Remix Assert

**Purpose**: Cross-environment assertion library (browser + Node.js compatible)

## Core Idea

`remix/assert` is a compatible subset of `node:assert/strict` that works in any JavaScript environment, including browsers. Uses strict equality (`===`) for all comparisons — no type coercion.

## Key Points

- Mirror of `node:assert/strict` APIs
- `assert.ok` — truthy check
- `assert.equal` / `assert.notEqual` — strict equality (`===` / `!==`)
- `assert.deepEqual` / `assert.notDeepEqual` — recursive strict deep equality
- `assert.match` — string matches a regexp
- `assert.throws` / `assert.rejects` — exception assertions
- All functions available as named exports

## Quick Example

```ts
import assert from 'remix/assert'

assert.ok(true)
assert.equal(1, 1)
assert.equal(1, '1') // throws — different types
assert.deepEqual({ a: 1 }, { a: 1 })
assert.match('hello', /ello/)
await assert.rejects(() => Promise.reject(new Error('oops')))
```

**Reference**: `packages/assert/README.md`

**Related**:
- concepts/testing-overview.md