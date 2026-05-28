# Example: Test Patterns

**Purpose**: Working code examples for common testing scenarios

## Basic Unit Test

```ts
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

describe('Math Utils', () => {
  it('adds numbers', () => {
    assert.equal(1 + 1, 2)
  })

  it('deepEqual for objects', () => {
    assert.deepEqual(
      { user: { name: 'Alice' } },
      { user: { name: 'Alice' } }
    )
  })
})
```

## Mocking Functions

```ts
import { describe, it } from 'remix/test'

describe('API Client', () => {
  it('mocks fetch', (t) => {
    let fetchMock = t.mock.fn(() => Promise.resolve({ json: () => ({ id: 1 }) }))
    
    let result = await fetchMock('/api/users')
    assert.equal(fetchMock.mock.calls.length, 1)
  })
})
```

## Spying on Methods

```ts
import { describe, it } from 'remix/test'

describe('Logger', () => {
  it('tracks warn calls', (t) => {
    let spy = t.mock.method(console, 'warn')
    
    console.warn('test message')
    
    assert.equal(spy.mock.calls.length, 1)
    assert.equal(spy.mock.calls[0].arguments[0], 'test message')
  })
})
```

## Cleanup

```ts
import { describe, it } from 'remix/test'

describe('Database', () => {
  it('connects and cleans up', (t) => {
    let conn = db.connect()
    t.after(() => conn.close())
    
    // test logic...
    assert.ok(conn.isConnected())
  })
})
```

**Reference**: `packages/test/README.md`

**Related**: concepts/testing-overview.md, guides/test-api.md