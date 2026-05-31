# Example: Assert API

**Purpose**: Demonstrating `remix/assert` methods in tests

## Basic Assertions

```ts
import assert from 'remix/assert'

// Truthy check
assert.ok(true)
assert.ok(false) // throws

// Strict equality
assert.equal(1, 1)
assert.equal(1, '1') // throws - different types
assert.notEqual('a', 'b')

// Deep equality
assert.deepEqual({ a: 1 }, { a: 1 })
assert.deepEqual({ a: 1 }, { a: '1' }) // throws

// Regex match
assert.match('hello world', /world/)
assert.match('hello', /xyz/) // throws

// Unconditional failure
assert.fail('should not reach here')
```

## Exception Assertions

```ts
import assert from 'remix/assert'

// Sync throw
assert.throws(() => {
  throw new TypeError('bad')
}, TypeError)

// Async rejection
await assert.rejects(
  () => Promise.reject(new Error('oops')),
  (err) => err.message === 'oops'
)
```

## Named Exports

```ts
import {
  ok,
  equal,
  notEqual,
  deepEqual,
  notDeepEqual,
  match,
  fail,
  throws,
  rejects,
} from 'remix/assert'

ok(true)
equal(1, 1)
```

**Reference**: `packages/assert/README.md`

**Related**: concepts/assert-overview.md