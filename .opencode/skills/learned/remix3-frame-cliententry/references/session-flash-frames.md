# session.flash in Remix 3 Frame Apps

**Extracted:** 2026-08-24

## Problem

`session.flash(key, value)` is the idiomatic one-shot message channel for a PRG form, but in a frame-based Remix 3 admin app two non-obvious things break it:

1. **The message is consumed but never displayed.** `app/ui/layout.tsx` reads `session.get('error' | 'success')` and renders the banner in the **top-level `<Layout>`**. Admin pages render as **frame fragments** — not the top-level `Layout` — so a flash set by a redirect is consumed on the next frame fetch and silently dropped. Two fragment render paths hit this:
   - The **sidebar shell**: pages render through `createSidebarLayout`'s `LayoutComponent` (`app/ui/sidebar-layout.tsx`), which previously rendered content only.
   - A **dual-render page's fragment branch**: a route that serves both a full document and a content-only fragment (Remix 3 detects `X-Remix-Target`; e.g. `renderVerwaltungPage`'s `isFrame` branch, `app/ui/verwaltung-layout.tsx`) renders content only in that branch.

2. **Tests read an empty session.** The session cookie value is a **signed** session id (`sessionCookie.serialize(sid)` → `session=<signed>`), not the raw id. `sessionStorage.read` expects the **raw** id, so `cookie.split('=')[1]` (which returns the signed value, truncating on any `=`) reads the wrong file → empty session → no flash. As of the session-middleware cookie-lifetime change (#11857), a cookie with a configured lifetime (`maxAge`/`expires` — this app's 30-day `sessionCookie`) stores a **signed JSON envelope** `{"value":"<sid>","expires":<ms>}`; the raw id is the envelope's `.value`, and a cookie without the envelope is treated as expired, starting a new session.

## Solution

### 1. Render the flash banner in the fragment render path

Surface `session.get('error' | 'success')` in whichever fragment path renders the content. Both are implemented in this repo — keep them in sync:

- **Sidebar shell** (`app/ui/sidebar-layout.tsx`): reads the flash in the content pane and renders `flashErrorStyle` / `flashSuccessStyle` banners above the breadcrumbs.
- **Dual-render page fragment branch** (`app/ui/verwaltung-layout.tsx`): reads the flash **only in the `isFrame` branch** so the two render paths never double-consume it.

`flashErrorStyle` / `flashSuccessStyle` mirror the `flashBase` + `surface.dangerBg` / `surface.successBg` tokens already in `app/ui/layout.tsx`. Put the banner style constants at **module scope**: this repo's oxlint rule `remix-style(prefer-let-locals)` uses `let` for locals and `const` only at module scope, so constants defined inside the factory get flagged.

### 2. Read the flash in tests via the parsed session id

Use the codec helpers exported from `app/middleware/session.ts` — do not hand-roll `sessionCookie.parse`/`serialize`, because the middleware wraps the id in a lifetime envelope when `maxAge` (or `expires`) is configured:

```ts
import { readSessionId, sessionStorage } from '../../middleware/session.ts'

let rawSid = await readSessionId(fresh.cookie)   // NOT cookie.split('=')[1]
let session = await sessionStorage.read(rawSid)
let err = session.get('error') as string | undefined
assert.ok(err?.includes('...'), 'flash error should be set')
```

- `readSessionId(cookieHeader)` verifies the signature, unwraps the `{ value, expires }` envelope and returns the raw id; `sessionStorage.read(rawSid)` loads the flash. It also passes through a legacy raw value.
- `serializeSessionCookie(sid)` is the inverse for tests that build a cookie directly from a `sessionStorage.save()` id.
- Use a **fresh** session cookie per test (e.g. `createAuthCookieWithCsrfForUser`), so a cookie shared across many tests doesn't accumulate/consume the flash.

## When to Use

- A PRG form in a frame-based Remix 3 admin app where the error/success flash never appears after a redirect.
- Adding a flash banner to a frame fragment (sidebar shell or an `isFrame` fragment branch) so one-shot PRG messages are visible.
- Writing a test that asserts a `session.flash` value — unwrap the signed cookie with `readSessionId` first.
- Debugging an assertion like `flash error should be set` failing with `session.get('error') === undefined`.