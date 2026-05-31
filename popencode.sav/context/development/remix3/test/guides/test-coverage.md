# Guide: Test Coverage

**Core Idea**: Comprehensive testing strategy with `remix/test` test runner + Playwright E2E.

## Test Types

| Type | Framework | Speed | Scope |
|------|-----------|-------|-------|
| Unit | remix/test | Fast | Single function |
| Integration | remix/test | Medium | Multiple components |
| E2E | Playwright | Slow | Full application |

## When to Use

- **Unit**: Pure functions, utilities
- **Integration**: Middleware, router, DB flows
- **E2E**: User interactions, complete flows

## Quick Example

```typescript
// Unit test
import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

describe('parsePage', () => {
  it('parses valid page', () => {
    assert.equal(parsePage(new URL('?page=2', 'http://test')), 2)
  })
})
```

## Best Practices

1. Test at appropriate level - don't over-mock
2. E2E for critical user flows
3. Unit for pure logic

**Reference**: `.opencode/context/development/remix3/guides/test-coverage.md`