# Mobile Nav Capability

## Overview

Responsive mobile navigation that replaces the desktop horizontal nav bar with a hamburger-triggered full-screen overlay on screens narrower than 768px. The overlay shows a curated set of action-oriented links appropriate for mobile use.

## Routes

| Route | Path | Auth | Mobile Label | Style |
|-------|------|------|-------------|-------|
| New Appointment | `/appointments/new` | required | "Neuer Termin" | Indigo CTA button |
| Settings | `/settings` | required | "Einstellungen" | Plain nav link |
| Login | `/auth/login` | when logged out | "Anmelden" | Plain nav link |
| Logout | `POST /auth/logout` | when logged in | "Abmelden" | Plain nav link + CSRF form |

## Auth States

### Logged In
- Neuer Termin → shown (CTA)
- Einstellungen → shown
- Abmelden → shown (form post with CSRF)
- Anmelden → hidden

### Logged Out
- Neuer Termin → hidden
- Einstellungen → hidden
- Abmelden → hidden
- Anmelden → shown

## Dependencies

- `app/utils/context.ts` — `getCurrentUserSafely()` for auth state
- `remix/ui` — `clientEntry` for hamburger toggle
- `remix/middleware/csrf` — `getCsrfToken()` for logout form
- `app/routes.ts` — route definitions
- `app/ui/nav.ts` — nav item data
- `app/ui/main-nav.tsx` — nav rendering

## States

- **Collapsed**: Hamburger icon visible in header bar, overlay hidden
- **Open**: Overlay covers entire viewport, hamburger becomes ✕
- **Empty (logged out)**: Overlay shows only "Anmelden" link
- **Full (logged in)**: Overlay shows Neuer Termin CTA, Einstellungen, Abmelden
