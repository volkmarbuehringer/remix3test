## Why

On mobile screens, the current horizontal nav bar overflows and shows a cramped, hard-to-tap set of links. The desktop nav is designed for browsing (8 items across) but mobile users primarily need action-oriented access: create a new appointment, manage settings, and log in/out.

## What Changes

- Add a hamburger button to the main nav that only renders on mobile (< 768px)
- On tap, a full-screen overlay appears with a curated set of mobile-specific routes:
  - "Neuer Termin" → `/appointments/new` (auth-gated, styled as indigo CTA button)
  - "Einstellungen" → `/settings` (auth-gated, plain link)
  - "Anmelden" / "Abmelden" (context-dependent, plain link)
- The overlay pops in instantly (no transition) with `transform-origin: top right`
- Desktop nav is completely unchanged

## Capabilities

### New Capabilities
- `mobile-nav`: Responsive mobile navigation with hamburger toggle and curated overlay

### Modified Capabilities
- *(none — existing specs unchanged)*

## Impact

- `openspec/changes/mobile-nav-hamburger/specs/mobile-nav/spec.md` — spec for the mobile nav capability
- `app/ui/nav.ts` — add mobile nav item definitions
- `app/ui/main-nav.tsx` — add hamburger button and overlay rendering, CSS media queries, overlay styles
- `app/assets/nav-toggle.tsx` — new `clientEntry` for hamburger toggle click handler
