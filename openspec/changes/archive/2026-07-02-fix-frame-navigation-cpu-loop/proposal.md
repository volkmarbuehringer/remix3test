## Why

Plain `<a>` tags navigating between Frame-relay-based pages (admin section ↔ lists section) lack the `rmx-document` attribute. Remix 3 intercepts these clicks, treats them as frame navigations instead of document navigations, and enters a frame-resolution loop that pegs the CPU at 100% and makes the browser completely unresponsive.

## What Changes

- Add `rmx-document` attribute to the description links on `/admin/lists` that break out of the admin-content Frame via `target="_top"`
- Add `rmx-document` attribute to the `MainNav` "Admin" link so it performs a document-level navigation when clicked from a Frame-relay page like `/lists`

## Capabilities

### New Capabilities

- `frame-document-navigation`: Links that navigate between Frame-relay-based route sections carry the `rmx-document` attribute, telling Remix 3 to perform a real document-level page navigation instead of a frame-based reload.

### Modified Capabilities

_None — this is a bug fix, not a requirement change._

## Impact

- `app/ui/admin-lists-page.tsx` — one `<a>` tag on line 321
- `app/ui/main-nav.tsx` — the `<a>` tag for the "Admin" nav item on line 65 (and any other MainNav links navigating between Frame-relay sections if applicable)
- No API, database, or dependency changes
