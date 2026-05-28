<!-- Context: development/remix3/core/concepts/remix-common-mistakes | Priority: high | Version: 1.0 | Updated: 2026-04-30 -->

# Concept: Common Remix Mistakes

**Core Idea**: The most common Remix 3 mistakes stem from treating it like React, wrong import paths, wrong middleware order, and skipping boundary validation.

## Architecture & Imports

- Treating Remix Component like React (hooks, implicit rerendering)
- Importing from top-level `remix` instead of subpath
- Calling `getContext()` without `asyncContext()` in the middleware stack
- Dropping shared code into `utils.ts` / `helpers.ts` / `common.ts` instead of owning directory
- Importing from `remix/component` — this subpath does NOT exist; `component()` factory function does NOT exist
- Using `handle.context.set()`/`.get()` in server-rendered components — context only works in `clientEntry` components

## Routes & Controllers

- Adding `clientEntry(...)` before server-rendered route behavior is correct
- Passing non-serializable props into `clientEntry(...)`
- Letting domain errors leak — translate validation, conflicts, not-found into HTTP `Response`, don't throw custom `Error` subclasses
- Skipping boundary validation on `FormData`, params, cookies, external payloads
- Building JSON-only RPC when form POST + redirect is simpler

## Middleware & Sessions

- Wrong middleware order — fast exits (static files) early, enrichment (session, auth) later
- Using `createCookie` when tamper-sensitive state needs `remix/session`
- Assuming authentication is enough without per-resource authorization

## Testing

- Writing only component tests for behavior that is really an HTTP route concern
- Treating JSON endpoints and `<Frame>` reloads as mutually exclusive (use whichever is lighter)

## Security Defaults

- Ship demo secrets in non-test environments — fail fast if `SESSION_SECRET`, provider secrets missing
- Hardened cookies: `httpOnly` always, `sameSite` by default, `secure` over HTTPS
- Regenerate session IDs on login, logout, privilege changes
- Add CSRF when browser forms mutate state with cookie-backed sessions
- Validate upload size, type, destination — filenames and content are untrusted

## Testing Defaults

- `router.fetch(new Request(...))` before component tests
- Fresh router per test/suite for isolated sessions, storage, DB
- Use `routes.<name>.href(...)` in tests to stay coupled to route contract
- `createMemorySessionStorage()` for auth/session test scenarios
- Component tests only for interactive/DOM-specific behavior

## Reference

- Full skill: `~/remix/skills/remix/SKILL.md` (sections: Core Remix Rules, Security, Testing, Common Mistakes)
- Auth patterns: `guides/auth-middleware.md`
- Testing: `guides/testing-patterns.md`
