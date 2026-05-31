<!-- Context: project-intelligence/my_app/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-02 -->

# Concept: Testing Conventions

## Test File Location

Tests co-locate with the file they test:
| File Under Test | Test File |
|---|---|
| `app/utils/ids.ts` | `app/utils/ids.test.ts` |
| `app/actions/chat/controller.tsx` | `app/actions/chat/controller.test.ts` |
| `app/actions/chat/page.tsx` | `app/actions/chat/page.test.ts` |
| `app/lib/messages-sse.ts` | `app/lib/messages-sse.test.ts` |

## Framework Selection

| Test Type | Framework | Assert | When |
|---|---|---|---|---|
| Pure functions | `remix/test` | `remix/assert` | No Remix dependency |
| Component rendering | `remix/test` | `remix/assert` | UI with `$rmx` VDOM walking |
| Integration (controller) | `remix/test` | `remix/assert` | Full middleware stack via `router.fetch()` |

## Auth Handling Conventions

**Integration tests use real session cookies** — never `SKIP_AUTH`:
1. Import `sessionCookie`, `sessionStorage` from `app/middleware/session.ts`
2. Create session with `new Session()` (or `createSession()`)
3. Set `auth: { userId }` — use `userId: 1` for the seeded admin user
4. Save session → serialize cookie → extract `session=<signed>` value
5. Pass as `headers: { Cookie: cookie }` on `router.fetch()`

**Graceful degradation**: Auth-requiring tests guard with `if (!authCookie) { return }` so tests pass even if DB is unavailable.

## Component Test Conventions

- Components export a **factory function** (e.g., `AgentPage()`) that returns a `renderFn`
- `renderFn(props)` returns a VDOM tree tagged with `$rmx: true` markers
- Test assertions walk the tree using `findElement()`, `findElementByProp()`, `treeContainsText()`
- These helpers are duplicated inline per test file (no shared test-utils import for VDOM helpers)
- Test both present AND absent states of conditional UI

## Integration Test Conventions

- Use `router.fetch(url, { redirect: 'manual' })` — prevents auto-follow of auth redirects
- Assert status codes explicitly: 200 (success), 302 (redirect), 400 (validation), 401 (auth), 429 (rate limit)
- For redirects, verify `Location` header value
- For HTML responses, use `response.text()` and check for string content
- For JSON responses, use `response.json()`
- Rate-limited endpoints need `await new Promise(r => setTimeout(r, ms))` between POSTs

## Coverage Expectations

| Area | Tests | Coverage |
|---|---|---|
| Pure utilities (parseId, hashPassword) | 16+ tests per file | All branches, all edge cases |
| Auth controllers (login, register, logout) | 5-10 tests per file | GET render, POST valid, POST invalid, empty fields |
| Protected controllers (lists, messages) | 7-10 tests per file | Auth gate, auth page render, valid/invalid POST |
| Agent controller | 5 tests | Page render, message validation, AI error path |
| Component rendering | 8-9 tests per component | Content render, empty state, conditional UI, edge cases |
| SSE/lib modules | 5 tests | Broadcast, client disconnect, rate limit map |

## Codebase References

- Session management: `my_app/app/middleware/session.ts`
- Router: `my_app/app/router.ts`
- Database init + seed: `my_app/app/data/setup.ts`
- Seeded users: `admin@myapp.com` / `admin123`, `user@myapp.com` / `password123`

## Related

- `guides/test-coverage.md` — How-to guide for writing tests
- `lookup/test-patterns.md` — Quick reference for common patterns
- `core/standards/concepts/test-coverage.md` — General testing standards
