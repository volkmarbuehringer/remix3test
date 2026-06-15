## Context

The `/appointments/new` page renders a sticky side panel for create/edit/delete actions, driven by URL parameters (`?editing=`, `?deleting=`, `?creating=true`). The panel uses `position: sticky` via `table.stickyPanel`, but the background table content remains scrollable. On mobile viewports, the user can scroll the page and lose context of the active form panel behind the viewport.

The mobile nav drawer (`app/ui/main-nav.tsx`) already has a scroll lock — but implemented via raw `document.body.style.overflow = 'hidden'` in `app/assets/nav-toggle.tsx:28`. This lacks scrollbar-gutter compensation (causes layout shift) and doesn't save/restore scroll position.

The built-in `lockScroll()` from `remix/ui/scroll-lock` handles both correctly: reference-counted, scrollbar-gutter preservation, scroll position restoration, and SSR-safe.

## Goals / Non-Goals

**Goals:**
- Lock page scroll while the side panel is open on `/appointments/new` (create/edit/delete)
- Replace the manual `overflow: hidden` in the mobile nav toggle with `lockScroll()` for proper scrollbar-gutter handling
- Use the existing `remix/ui/scroll-lock` API consistently across both surfaces

**Non-Goals:**
- No new modal/overlay UI pattern — the sticky panel stays inline
- No behavioral change to the nav drawer's open/close lifecycle
- No responsive layout changes to the two-column grid

## Decisions

**1. Appointments page: clientEntry that reads URL state on page load**
Since the panel open/close is driven by server-rendered URL state (full page navigations), there's no client-side toggle event to hook into. A clientEntry component will:
- On mount, check `location.search` for `editing=`, `deleting=`, or `creating=true`
- If a panel is open, call `lockScroll()` and store the unlock function
- Register a `popstate` listener to re-evaluate on back/forward navigation
- Clean up on unmount

Alternatives considered:
- **Server-rendered `<script>` block** — could inline a scroll-lock call, but creates duplication and bypasses the standard clientEntry lifecycle
- **MutationObserver on the panel DOM** — fragile, couples to HTML structure
- **CSS-only `overflow: hidden` on `<html>`** when panel present — would require server-side class toggling, no scrollbar-gutter compensation

**2. Nav drawer: replace `document.body.style.overflow` with `lockScroll()`**
The nav toggle clientEntry already manages open/close. The simplest path:
- `lockScroll()` returns an idempotent unlock function
- Store the unlock function in the outer closure
- On toggle open → call `lockScroll()`, on close → call unlock

Alternatives considered:
- **`lockScrollOnToggle()` mixin** — would require restructuring the nav toggle to use popover `beforetoggle` events, which doesn't match its current class-based toggle pattern

## Risks / Trade-offs

- **Appointments page: race condition on rapid nav** — If user clicks through panel states quickly (edit → delete), each page load creates a new clientEntry instance. The old instance's unlock fires on unmount. This is fine because `lockScroll()` is reference-counted.
- **Appointments page: popstate handling** — Browser back/forward changes URL but doesn't remount the clientEntry. The `popstate` listener detects state changes and calls lock/unlock accordingly.
- **Nav drawer: no behavioral change** — The replacement is mechanical. The drawer already works; this just fixes the scrollbar-gutter and scroll-position issues.
