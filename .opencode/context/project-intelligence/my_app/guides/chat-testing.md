<!-- Context: project-intelligence/my_app/guides | Priority: high | Version: 1.0 | Updated: 2026-05-02 -->

# Guide: Chat Testing Patterns

**Purpose**: Three test layers for the chat feature — real DB tests, router integration tests, and component tests.

## Prerequisites

- PostgreSQL running locally (`postgresql://postgres:postgres@localhost:5432/my_app`)
- `DATABASE_URL` env var or default connection string
- `remix/test` test runner

## Test Layer 1: Database Tests

File: `app/lib/chatlog.test.ts` — 11 tests with real PostgreSQL.

**Setup pattern**:
```typescript
import { Pool } from 'pg'

const TEST_PREFIX = `test-${Date.now()}-`

let pool: Pool
before(async () => {
  pool = new Pool({ connectionString: DATABASE_URL })
  await pool.query(`CREATE TABLE IF NOT EXISTS chatlog (...)` )
})
after(async () => {
  await pool.query(`DELETE FROM chatlog WHERE id LIKE '${TEST_PREFIX}%'`)
  await pool.end()
})
```

**Key patterns**:
- **Test prefix isolation**: `testId('label')` → `test-{timestamp}-{label}` — cleanup by prefix
- **Direct DB verification**: `pool.query('SELECT ...')` after calling chatlog functions
- **Concurrent mod test**: Sequential appends verify optimistic concurrency works end-to-end
- **Empty/whitespace validation**: `assert.rejects()` for `appendMessage` with empty content

## Test Layer 2: Router Integration Tests

File: `app/actions/chat/controller.test.ts` — 6 tests via `remix/test` runner.

**Setup pattern**:
```typescript
import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { router } from '../../router.ts'
```

**Key patterns**:
- **Real HTTP**: `router.fetch('https://remix.run/chat', { method, body, redirect: 'manual' })`
- **Rate limiting awareness**: Tests handle both 400 and 429 responses gracefully
- **AI error path**: Dummy API key causes LLM call to fail — tests redirect with `?error=` param
- **Explicit wait**: `await new Promise(r => setTimeout(r, 2100))` between POST tests to bypass 2s rate limit

## Test Layer 3: Component Tests

File: `app/actions/chat/page.test.ts` — 8 tests using `remix/test`.

**Setup pattern**:
```typescript
import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { ChatPage } from './page.tsx'
```

**Key patterns**:
- **Remix VDOM walking**: `findElement(node, predicate)` searches element tree via `$rmx` marker
- **Text content search**: `treeContainsText(tree, 'text')` recursively checks children
- **Prop-based search**: `findElementByProp(tree, 'role', 'alert')` for accessibility checks
- **Conditional render tests**: Verify error banner presence/absence based on `error` prop

## Running Tests

```sh
npm test                     # All tests
node --test app/lib/chatlog.test.ts  # Single file
node --test --watch app/lib/chatlog.test.ts  # Watch mode
```

## Verification Checklist

- [ ] Database tests leave no test rows behind (prefix-based cleanup)
- [ ] Router tests handle rate limiting (2s window between POSTs)
- [ ] Component tests check both present and absent states of conditional UI
- [ ] All three test layers pass without external API key

## Codebase References

**Implementation under test**:
- `my_app/app/lib/chatlog.ts` — DB functions (chatlog.test.ts)
- `my_app/app/actions/chat/controller.tsx` — Controller (controller.test.ts)
- `my_app/app/actions/chat/page.tsx` — Page component (page.test.ts)

**Tests**:
- `my_app/app/lib/chatlog.test.ts` — Real DB tests (11 tests)
- `my_app/app/actions/chat/controller.test.ts` — Router integration tests (6 tests)
- `my_app/app/actions/chat/page.test.ts` — Component tests (8 tests)

## Related

- `concepts/chat-architecture.md` — Architecture decisions tested here
- `lookup/chat-patterns.md` — Quick reference for patterns
- `core/standards/concepts/test-coverage.md` — General testing standards
