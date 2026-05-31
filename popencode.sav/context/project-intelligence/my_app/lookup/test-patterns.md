<!-- Context: project-intelligence/my_app/lookup | Priority: medium | Version: 1.0 | Updated: 2026-05-02 -->

# Lookup: Test Pattern Reference

## Test File Inventory

| File | Framework | Tests | Area |
|---|---|---|---|---|
| `app/utils/password-hash.test.ts` | `remix/test` | 16 | Pure utility |
| `app/utils/ids.test.ts` | `remix/test` | 18 | Pure utility |
| `app/utils/pagination.test.ts` | `remix/test` | 4 | Pure utility |
| `app/utils/sort-params.test.ts` | `remix/test` | 6 | Pure utility |
| `app/lib/messages-sse.test.ts` | `remix/test` | 5 | SSE module |
| `app/actions/auth-login/controller.test.ts` | `remix/test` | 10 | Auth integration |
| `app/actions/auth-register/controller.test.ts` | `remix/test` | 5 | Auth integration |
| `app/actions/auth-logout.test.ts` | `remix/test` | 2 | Auth integration |
| `app/actions/agent/controller.test.ts` | `remix/test` | 5 | Agent integration |
| `app/actions/agent/page.test.ts` | `remix/test` | 9 | Component |
| `app/actions/lists/controller.test.ts` | `remix/test` | 10 | Lists integration |
| `app/actions/messages/controller.test.ts` | `remix/test` | 7 | Messages integration |
| `app/actions/messages/fragment-page.test.ts` | `remix/test` | 8 | Component |
| `app/actions/messages-content.test.ts` | `remix/test` | 2 | Messages integration |
| `app/actions/messages-subscribe.test.ts` | `remix/test` | 2 | Messages integration |

## Common Setup Templates

**Pure function**: `remix/test` + `remix/assert`
**Integration**: `remix/test` + `remix/assert` + `router.fetch()`
**Component**: `remix/test` + `remix/assert` + inline VDOM helpers

## Auth Session Cookie Recipe

```typescript
import { createSession } from 'remix/session'
import { sessionCookie, sessionStorage } from '../../middleware/session.ts'

async function createAuthCookie(userId = 1): Promise<string> {
  let session = createSession<{ auth: { userId: number } }>()
  session.set('auth', { userId })
  let sid = await sessionStorage.save(session)
  return (await sessionCookie.serialize(sid!)).split(';')[0]
}
```

## VDOM Walking Helpers

```typescript
function findElement(node, predicate): RemixElement | null
function findElementByProp(node, key, value): RemixElement | null
function treeContainsText(node, text): boolean
```
Walk `$rmx`-tagged tree via `props.children`. Duplicated inline per test file.

## Status Code Quick Reference

| Code | Meaning | Assertion |
|---|---|---|
| 200 | Success | `assert.equal(response.status, 200)` |
| 302 | Redirect | `assert.equal(response.headers.get('Location'), target)` |
| 400 | Validation | `assert.equal(response.status, 400)`, check JSON/body |
| 401 | Auth error | `response.text()` contains "Invalid email or password" |
| 429 | Rate limited | `assert.ok(response.headers.has('Retry-After'))` |

## Rate Limiting Pattern

```typescript
await new Promise((r) => setTimeout(r, RATE_LIMIT_MS + 100))
if (response.status === 429) { assert.ok(true, 'rate limited') }
```

## Sanitization / Truncation

```typescript
let malicious = '<script>alert("xss")</script>' // Strips angle brackets, quotes
let longContent = 'A'.repeat(1500)               // Truncated to 1000 chars
```

## Related

- `guides/test-coverage.md` — How-to guide
- `concepts/testing-conventions.md` — Standards
- `../errors/vdom-testing-gotchas.md` — Button type resolution, theme contract properties in VDOM tests
- `development/remix3/test/concepts/testing-overview.md` — Remix test framework
