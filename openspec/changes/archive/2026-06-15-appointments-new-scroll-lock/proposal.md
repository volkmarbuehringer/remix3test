## Why

The `/appointments/new` page opens a sticky side panel for create/edit/delete operations, but the background page content continues to scroll behind it. On mobile viewports this creates a broken UX — the panel content scrolls off-screen with the page, and there's no visual indication the panel is a focused interaction surface. The `remix/ui/scroll-lock` API already exists but isn't being used here.

## What Changes

- Import and invoke `lockScroll()` when the side panel opens on `/appointments/new` for create, edit, or delete
- Unlock scroll when the panel closes (user navigates away, completes action, or cancels)
- Properly handle scrollbar gutter compensation to prevent layout shift
- Handle the SSR case (panel state driven by URL params, rendered server-side — need a clientEntry component)
- Apply scroll-lock on the mobile nav drawer as well, replacing the manual `document.body.style.overflow = 'hidden'` with the proper `lockScroll()` utility

## Capabilities

### New Capabilities
- `appointments-page-scroll-lock`: Lock document scroll while the side panel (create/edit/delete) is open on `/appointments/new`, with proper scrollbar-gutter compensation and position restoration

### Modified Capabilities
- `mobile-nav`: Replace the naive `document.body.style.overflow = 'hidden'` in the nav toggle clientEntry with `lockScroll()` / `lockScrollOnToggle()` from `remix/ui/scroll-lock`

## Impact

- `app/actions/appointments-new/controller.tsx` — render state signals for the clientEntry
- `app/assets/nav-toggle.tsx` — replace manual overflow toggle with lockScroll()
- `app/ui/appointments-new-page.tsx` — add clientEntry for scroll-lock lifecycle
- New or modified clientEntry component in `app/assets/` for the appointments page panel lifecycle
