<!-- Context: project-intelligence/my_app/guides | Priority: high | Version: 1.0 | Updated: 2026-05-02 -->

# Guide: Test Coverage Patterns

**Purpose**: Three test tiers used across my_app — pure function tests, integration tests via `router.fetch()`, and Remix VDOM component tests.

## Tier 1: Pure Function Tests

Use `remix/test` + `remix/assert` for utilities with no Remix dependency.

**Setup pattern**:
```typescript
import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { parseId } from './ids.ts'
```

**Patterns**:
- **AAA structure**: Arrange → Act → Assert with section comments
- **Edge case coverage**: null, undefined, empty string, NaN, Infinity, objects, arrays
- **Malformed input safety**: `verifyPassword` returns false (never throws) for any string — tested with a loop over edge inputs
- **Safe integer boundaries**: `Number.MAX_SAFE_INTEGER`, negative numbers, string coercion

**Files**: `app/utils/password-hash.test.ts` (16 tests), `app/utils/ids.test.ts` (18 tests), `app/lib/messages-sse.test.ts` (5 tests)

## Tier 2: Integration Tests via router.fetch()

Use `remix/test` + `remix/assert` for controller integration through the full middleware stack — no mocking needed.

**Setup pattern**:
```typescript
import * as assert from 'remix/assert'
import { describe, it, before } from 'remix/test'
import { router } from '../../router.ts'
```

**Key pattern — authenticated requests with real session cookies**:
```typescript
import { sessionCookie, sessionStorage } from '../../middleware/session.ts'
import { createSession } from 'remix/session'

// In before(): create a real session cookie for the seeded user
let session = createSession<{ auth: { userId: number } }>()
session.set('auth', { userId: 1 })
let sid = await sessionStorage.save(session)
let cookie = (await sessionCookie.serialize(sid!)).split(';')[0]
// Use: headers: { Cookie: cookie }
```

**Patterns**:
- **Auth gate tests**: `redirect: 'manual'` → assert `status === 302` and `Location === '/login'`
- **GET form rendering**: Assert `response.status === 200`, check HTML string for inputs, form tags, headings
- **POST valid credentials**: Assert `status === 302` redirect to `/`
- **POST invalid credentials**: Assert `status === 401` and error message in HTML body
- **JSON API responses**: `response.json()` for structured error/success payloads
- **Rate limiting**: Wait between POSTs, assert `status === 429` with `Retry-After` header
- **External API error path**: Set dummy `OPENCODE_API_KEY`, verify graceful redirect with agentId param
- **DB-backed state**: Call `save` endpoint, then query DB via `db.findMany()` to get created resource ID

**Files**:
- `app/actions/auth-login/controller.test.ts` (10 tests)
- `app/actions/auth-register/controller.test.ts` (5 tests)
- `app/actions/auth-logout.test.ts` (2 tests)
- `app/actions/agent/controller.test.ts` (5 tests)
- `app/actions/lists/controller.test.ts` (10 tests)
- `app/actions/messages/controller.test.ts` (7 tests)
- `app/actions/messages-content.test.ts` (2 tests)
- `app/actions/messages-subscribe.test.ts` (2 tests)

## Tier 3: Component Tests via VDOM Walking

Use `remix/test` + `remix/assert` for UI component rendering. Call exported page components directly as functions, then walk the Remix VDOM tree via `$rmx` markers.

**Setup pattern**:
```typescript
import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { AgentPage } from './page.tsx'
```

**Key helpers** (inline in each test file):
```typescript
function findElement(node, predicate): RemixElement | null      // Recursive search by predicate
function findElementByProp(node, propKey, propValue)             // Shorthand for prop match
function treeContainsText(node, text): boolean                   // Text content search
```

**Patterns**:
- **Render function pattern**: Components export a factory `AgentPage()` → returns `renderFn(props) → tree`
- **Present/absent testing**: Assert text IS present, then assert text is NOT present for conditional UI
- **Element by prop**: `findElement(tree, el => el.props.name === 'conversationId')` to find hidden inputs
- **Empty state**: Verify empty-state heading + description text when messages array is empty
- **Pagination buttons**: Assert "Newer"/"Older" presence based on `offset` and `hasMore` props

**Files**: `app/actions/agent/page.test.ts` (9 tests), `app/actions/messages/fragment-page.test.ts` (8 tests)

## Running Tests

```sh
npm test                              # All tests
node --test app/utils/ids.test.ts     # Single file
```

## Codebase References

- **Helper files**: `app/middleware/session.ts` — `sessionCookie`, `sessionStorage` exports
- **Router**: `app/router.ts` — exports `router` for `router.fetch()`
- **Data**: `app/data/setup.ts` — `initializeAppDatabase()`, seeded users (admin@myapp.com, user@myapp.com)
- **Test runner**: `remix/test` for all test tiers

## Related

- `concepts/testing-conventions.md` — Standards and conventions
- `lookup/test-patterns.md` — Quick reference for common patterns
- `guides/chat-testing.md` — Chat-specific 3-layer testing
- `guides/e2e-testing.md` — Playwright E2E testing
- `core/standards/concepts/test-coverage.md` — General testing standards
