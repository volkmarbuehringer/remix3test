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

Surface `session.get('error' | 'success')` in whichever fragment path renders the content. All fragment paths use the shared `FlashBanner` (`app/ui/flash-banner.tsx`, which owns the module-scope styles):

- **Document layout** (`app/ui/layout.tsx`): `<FlashBanner />`.
- **Sidebar shell** (`app/ui/sidebar-layout.tsx`): `<FlashBanner compact />` above the breadcrumbs, **only when the shell is the response root** (`isFrameRequest()`) — a POST re-render embeds the shell in `Layout`, which owns the flash there.
- **Dual-render page fragment branches**: `<FlashBanner compact />` **only in the `isFrame` branch** (`app/ui/verwaltung-layout.tsx`, `SettingsView`'s isFrame branch, `renderAppointmentsNewPage`'s frame branch) so the two render paths never double-consume it.

### 1a. An inlined (SSR-resolved) frame must not repeat the document flash

Since preview build `3273a048` (#12153) `render()` waits for the **shell** chunk before its middleware returns. The blocking self-relay `<Frame>` therefore resolves its internal subrequest *before* the outer session middleware saves — and clears — the flash, so the inlined fragment reads it too and a full-document GET rendered the banner twice: once in the document `Layout`, once inside the shell (`/admin/users`, `/appointments/new`).

The renderer marks its own frame subrequests with `X-Remix-Top-Frame-Src` (the enclosing document URL); a browser frame navigation sends `X-Remix-Frame`/`X-Remix-Target` but never that header. `FlashBanner` skips the banner when `currentRequestIsInlinedFrame()` (`app/utils/frame-target.ts`) is true, so exactly one banner survives per response regardless of stream timing: a document render (any method; blocking or streaming shell) surfaces it through the document `Layout` and keeps inlined fragments silent, while a browser frame navigation surfaces it through the fragment renderer. The sidebar shell's own compact banner is gated on `isFrameRequest()` for the same reason (see above).

Guards: `app/ui/sidebar-layout.test.ts` (full document exactly once; the renderer's internal header set renders no banner; POST re-render exactly once) and `app/actions/appointments-new/controller.test.ts` (full document exactly once with a blocking page frame).

### 1b. The in-frame PRG follow must run outside the session middleware

`frameRedirects()` re-fetches the redirect destination as a new request. If it sits **inside** `session()`, the session middleware has not persisted the flash yet (it saves when the outer response unwinds), so the follow re-reads the pre-redirect session and the flash is silently dropped. Put `frameRedirects()` before `session()` in the middleware stack (`app/middleware/root.ts`). The follow's own session read then finds the stored flash, and its response clears it.

The reorder also puts the follow **after** the redirect's session save, so it must inherit the redirect's `Set-Cookie`: carry those cookies into the follow request (session ids can rotate) and re-emit them on the final response, which replaces the 302. `app/middleware/frame-redirect.ts` does both.

The in-memory test store does **not** hide the ordering bug: `createMemorySessionStorage` snapshots `session.data` and returns a fresh `Session` on read, like the fs store. What hid it was tests that only inspected the saved flash after the request (e.g. `readSuccessFlash()`): the POST still saves the flash, so they pass even when the followed fragment never rendered it. Assert the followed fragment's HTML instead — `app/actions/settings/controller.test.ts` does.

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
- An in-frame PRG flash never renders after a redirect: check `frameRedirects()` sits outside `session()` (and that the follow inherits the redirect's `Set-Cookie`).
- A full-document GET shows the flash twice (once in the page chrome, once inside a blocking shell): the fragment the renderer inlined must skip it — check `FlashBanner`'s `currentRequestIsInlinedFrame()` guard and the shell's `isFrameRequest()` gate on its own banner.