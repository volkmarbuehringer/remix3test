---
name: remix3-session-flash-frames
description: "Use when a session.flash PRG message never appears inside a Remix 3 frame fragment, or when a test asserting a session.flash value reads an empty session — session.flash is rendered only by the top-level Layout (fragments need a shell banner), and reading it in tests requires parsing the signed session cookie."
metadata:
  origin: auto-extracted
---

# session.flash in Remix 3 Frame Apps

**Extracted:** 2026-08-24
**Context:** Converting an admin row toggle from a JSON fetch to a server-rendered POST form with Post/Redirect/Get + `session.flash` error handling on the shared frame runtime (`renderAdminPage` / `createSidebarLayout`).

## Problem

`session.flash(key, value)` is the idiomatic one-shot message channel for a PRG form, but in a frame-based Remix 3 admin app two non-obvious things break it:

1. **The message is consumed but never displayed.** `app/ui/layout.tsx` reads `session.get('error' | 'success')` and renders the banner in the **top-level `<Layout>`**. Admin pages render as **frame fragments** through `createSidebarLayout`'s `LayoutComponent` (the sidebar shell) — not the top-level `Layout`. So a flash set by a redirect is consumed on the next frame fetch and silently dropped; the PRG error/success banner never appears.

2. **Tests read an empty session.** The session cookie value is a **signed** session id (`sessionCookie.serialize(sid)` → `session=<signed>`), not the raw id. `sessionStorage.read` expects the **raw** id, so `cookie.split('=')[1]` (which returns the signed value, truncating on any `=`) reads the wrong file → empty session → no flash.

## Solution

### 1. Render the flash banner in the sidebar shell
Frame fragments render through the shell, so surface `session.get('error' | 'success')` in `createSidebarLayout`'s content pane:

```tsx
let flashError: string | undefined
let flashSuccess: string | undefined
try {
  let session = getContext().session
  if (session) {
    let err = session.get('error')
    if (typeof err === 'string') flashError = err
    let success = session.get('success')
    if (typeof success === 'string') flashSuccess = success
  }
} catch { /* no session context */ }

return (
  <div mix={shellStyle}>
    <aside ...>{sidebar}</aside>
    <section mix={contentStyle}>
      {flashError ? <div mix={flashErrorStyle}>{flashError}</div> : null}
      {flashSuccess ? <div mix={flashSuccessStyle}>{flashSuccess}</div> : null}
      <Breadcrumbs items={...} />
      {children}
    </section>
  </div>
)
```

Put the banner style constants at **module scope**: this repo's oxlint rule `remix-style(prefer-let-locals)` uses `let` for locals and `const` only at module scope, so constants defined inside the `createSidebarLayout` factory get flagged.

### 2. Read the flash in tests via the parsed session id
Parse the **signed** cookie back to the raw id before reading:

```ts
import { sessionCookie, sessionStorage } from '../../middleware/session.ts'

let rawSid = (await sessionCookie.parse(fresh.cookie)) as string   // NOT cookie.split('=')[1]
let session = await sessionStorage.read(rawSid)
let err = session.get('error') as string | undefined
assert.ok(err?.includes('...'), 'flash error should be set')
```

- `sessionCookie.parse(cookieHeader)` verifies the signature and returns the raw id; `sessionStorage.read(rawSid)` loads the flash.
- Use a **fresh** session cookie per test (e.g. `createAuthCookieWithCsrfForUser`), so a cookie shared across many tests doesn't accumulate/consume the flash.

## When to Use
- A PRG form in a frame-based Remix 3 admin app where the error/success flash never appears after a redirect.
- Adding a flash banner to a frame fragment (sidebar shell) so one-shot PRG messages are visible.
- Writing a test that asserts a `session.flash` value — parse the signed cookie first.
- Debugging an assertion like `flash error should be set` failing with `session.get('error') === undefined`.
