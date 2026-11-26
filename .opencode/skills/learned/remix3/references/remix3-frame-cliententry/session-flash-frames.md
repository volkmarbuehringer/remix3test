# session.flash in Remix 3 Frame Apps

**Extracted:** 2026-08-24
**Updated:** 2026-11-17 — one owner per response (`FlashFragment`), typed `FLASH_KEYS` helpers + source guard, and the success live region (`FlashAnnouncer`).

## Problem

`session.flash(key, value)` is the idiomatic one-shot message channel for a PRG form, but in a frame-based Remix 3 admin app two non-obvious things break it:

1. **The message is consumed but never displayed.** The banner lives in `app/ui/layout.tsx`'s top-level `Layout`. Admin and editor pages render as **frame fragments** — not the top-level `Layout` — so a flash set by a redirect is consumed on the next frame fetch and silently dropped unless the fragment renderer surfaces it. Two categories hit this: the **sidebar shell** (`app/ui/sidebar-layout.tsx`) and a **dual-render page's fragment branch** (e.g. `renderVerwaltungPage`'s `isFrame` branch, `SettingsView`'s `isFrame` branch, `renderAppointmentsNewPage`'s frame branch). A renderer that is added or rewired without the banner silently drops it again; the lists editor shell (`app/ui/lists-layout.tsx`) was one such gap long before its mutations used a flash.

2. **Tests read an empty session.** The session cookie value is a **signed** session id (`sessionCookie.serialize(sid)` → `session=<signed>`), not the raw id. `sessionStorage.read` expects the **raw** id, so `cookie.split('=')[1]` (which returns the signed value, truncating on any `=`) reads the wrong file → empty session → no flash. As of the session-middleware cookie-lifetime change (#11857), a cookie with a configured lifetime (`maxAge`/`expires` — this app's 30-day `sessionCookie`) stores a **signed JSON envelope** `{"value":"<sid>","expires":<ms>}`; the raw id is the envelope's `.value`, and a cookie without the envelope is treated as expired, starting a new session.

## Solution

### 1. One owner per response: `Layout` or `FlashFragment`

Surface `session.get('error' | 'success')` from exactly one component per response:

- **Document layout** (`app/ui/layout.tsx`): `<FlashBanner />`.
- **Every fragment renderer**: wrap the content in `FlashFragment` (`app/ui/flash-fragment.tsx`). It renders `<FlashBanner compact />` only when the request has an `X-Remix-Target` and is not an inlined SSR subrequest, so a document POST re-render (where the shell is embedded in `Layout`) renders no second banner. Owners: the sidebar shell (including its content-only branch for agent-panel pages), the lists shell (`app/ui/lists-layout.tsx`), `renderVerwaltungPage`'s fragment branch, `SettingsView`'s `isFrame` branch, `renderAppointmentsNewPage`'s frame branch, and `AppointmentPage`'s `isFrame` branch.
- Do **not** render `<FlashBanner compact />` by hand at a new render path; use `FlashFragment`. The fragment paths are pinned by `app/frame-targets.test.ts` ("surfaces a session flash in every fragment render path exactly once") — an unwrapped renderer returns a fragment without the message.

### 1a. An inlined (SSR-resolved) frame must not repeat the document flash

Since preview build `3273a048` (#12153) `render()` waits for the **shell** chunk before its middleware returns. The blocking self-relay `<Frame>` therefore resolves its internal subrequest *before* the outer session middleware saves — and clears — the flash, so the inlined fragment reads it too and a full-document GET rendered the banner twice: once in the document `Layout`, once inside the shell (`/admin/users`, `/appointments/new`).

The renderer marks its own frame subrequests with `X-Remix-Top-Frame-Src` (the enclosing document URL); a browser frame navigation sends `X-Remix-Frame`/`X-Remix-Target` but never that header. `FlashBanner` skips the banner when `currentRequestIsInlinedFrame()` (`app/utils/frame-target.ts`) is true, so exactly one banner survives per response regardless of stream timing: a document render (any method; blocking or streaming shell) surfaces it through the document `Layout` and keeps inlined fragments silent, while a browser frame navigation surfaces it through `FlashFragment`. `FlashFragment` also skips the banner when the request has no `X-Remix-Target`, which covers the document POST re-render where the shell is embedded in `Layout`.

Guards: `app/ui/sidebar-layout.test.ts` (full document exactly once; the renderer's internal header set renders no banner; POST re-render exactly once), `app/actions/appointments-new/controller.test.ts` (full document exactly once with a blocking page frame), and `app/frame-targets.test.ts` (a seeded flash renders exactly once for every PRG fragment path).

### 1b. The in-frame PRG follow must run outside the session middleware

`frameRedirects()` re-fetches the redirect destination as a new request. If it sits **inside** `session()`, the session middleware has not persisted the flash yet (it saves when the outer response unwinds), so the follow re-reads the pre-redirect session and the flash is silently dropped. Put `frameRedirects()` before `session()` in the middleware stack (`app/middleware/root.ts`). The follow's own session read then finds the stored flash, and its response clears it.

The reorder also puts the follow **after** the redirect's session save, so it must inherit the redirect's `Set-Cookie`: carry those cookies into the follow request (session ids can rotate) and re-emit them on the final response, which replaces the 302. `app/middleware/frame-redirect.ts` does both.

The in-memory test store does **not** hide the ordering bug: `createMemorySessionStorage` snapshots `session.data` and returns a fresh `Session` on read, like the fs store. What hid it was tests that only inspected the saved flash after the request (e.g. `readSuccessFlash()`): the POST still saves the flash, so they pass even when the followed fragment never rendered it. Assert the followed fragment's HTML instead — `app/actions/settings/controller.test.ts` does.

### 1c. Announce the flash to assistive technology

The two tones need different mechanisms:

- **Error**: the visual banner renders `role="alert"` + `aria-atomic="true"`. An alert is announced when it is inserted by a frame swap and (in practice) when it is parsed on a PRG document load.
- **Success**: no live role on the visual banner. A `role="status"` element created together with its content inside a frame swap is a *new* live region, which screen readers do not announce. Instead, `FlashAnnouncer` (`app/ui/flash-announcer.browser.tsx`) is mounted once in `app/ui/document.tsx`, renders a persistent `[data-flash-status]` `role="status" aria-live="polite" aria-atomic="true"` region outside every frame, and mirrors success banners into it: an initial scan after hydration (PRG document load) plus a filtered `MutationObserver` (frame swap, text change). It skips `data-flash-tone="error"` so the alert is not announced twice. The observer is scoped to `[data-page-scroller]` (where frame content renders, matching `GridStatusAnnouncer`), so chat/typing mutations stay off this path; the initial scan covers the document `Layout` banner outside the scroller.
- Do **not** give the success banner its own `role="status"`/`aria-live`; it double-announces with the persistent region. Do not drop the initial scan: a PRG destination with a success flash would otherwise never be announced.
- **No-JS tradeoff**: without JavaScript the persistent region is never filled, so a success flash is visible but not announced (the page load is the only cue); error banners still use `role="alert"`. A no-JS screen-reader requirement would need a separate fallback.
- Guards: `app/ui/flash-announcer.test.browser.tsx` (initial, frame-swap insertion, text change, error skip, unrelated mutation inside the scroller), `app/ui/layout.test.ts` pins `role="alert"`, `data-flash-tone`, and the `[data-flash-status]` region, and `app/actions/settings/settings-flash-announcement.test.e2e.ts` drives a real in-frame page-size PRG and asserts the region fills after hydration (the seam direct rendering cannot cover).

### 1d. Single-source the flash vocabulary

`app/utils/flash.ts` owns `FLASH_KEYS` (`error`, `success`), `FlashTone`, `readFlash`, and the write helpers `flash`/`flashError`/`flashSuccess`. `app/middleware/session.ts` passes `FLASH_KEYS` to `mergeSessionWrites`, so the banner, the merge, and the write sites cannot disagree: a key outside the list is silently dropped by the merge (the old `reset`/`verified` bug), and a bespoke key never renders. `app/utils/flash.test.ts` has a source guard that fails if production code calls `session.flash()` directly — write through the typed helpers.

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
- Adding a new fragment renderer or changing which component owns the flash: wrap the content in `FlashFragment`; never render `<FlashBanner compact />` by hand at a new path.
- You need a new flash tone/key: add it to `FLASH_KEYS` in `app/utils/flash.ts` and write through `flash`/`flashError`/`flashSuccess` (the source guard rejects a bare `session.flash()` call).
- Writing a test that asserts a `session.flash` value — unwrap the signed cookie with `readSessionId` first.
- Debugging an assertion like `flash error should be set` failing with `session.get('error') === undefined`.
- An in-frame PRG flash never renders after a redirect: check `frameRedirects()` sits outside `session()` (and that the follow inherits the redirect's `Set-Cookie`).
- A success flash is visible after an in-frame PRG but a screen reader does not announce it: check `FlashAnnouncer` is mounted in `app/ui/document.tsx` and the success banner carries `data-flash-tone="success"`; error banners must keep `role="alert"`.
- A full-document GET shows the flash twice (once in the page chrome, once inside a blocking shell): the fragment the renderer inlined must skip it — check `FlashFragment`'s `X-Remix-Target`/`currentRequestIsInlinedFrame()` gate and the document `Layout` ownership.