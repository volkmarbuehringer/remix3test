# Assert

A compatible subset of `node:assert/strict` that works in any JavaScript environment — plus a chainable `expect` API.

## Key Points

- **Cross-Platform**: Works in browsers, Node.js, Bun, Deno, Workers — no native dependencies
- **Strict Equality**: Uses `===` for all comparisons (no type coercion)
- **`expect()` API**: Chainable matchers — `.toBe()`, `.toEqual()`, `.toThrow()`, `.toHaveBeenCalled()` etc.
- **Async Support**: `assert.rejects()`, `expect().rejects`, `expect().resolves`

## Quick Example

```ts
import assert from 'remix/assert'
import { expect } from 'remix/assert'

assert.equal(1, 1)
assert.deepEqual({ a: 1 }, { a: 1 })
assert.throws(() => { throw new Error('oops') })
await assert.rejects(() => Promise.reject(new Error('fail')))

// Chainable matchers
expect(value).toBe(42)
expect({ a: 1 }).toEqual({ a: 1 })
expect(spy).toHaveBeenCalledWith('hello')
await expect(fetch('/missing')).rejects.toThrow('Not found')
```

## Reference

- Full docs: `~/remix/packages/assert/README.md`
- Imports: `remix/assert` (default + named), `expect` from `remix/assert`

## Related

- [test](https://github.com/remix-run/remix/tree/main/packages/test) — Test framework that pairs with assert
