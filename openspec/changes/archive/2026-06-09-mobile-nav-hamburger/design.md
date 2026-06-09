## Context

The app uses `app/ui/nav.ts` to define `NAV_SECTIONS` (8 items in one section), rendered in `app/ui/main-nav.tsx` as a horizontal bar. Client-side interactivity uses `clientEntry` from `remix/ui` (see `app/assets/theme-toggle.tsx` for the established pattern). Auth state is read via `getCurrentUserSafely()` from `app/utils/context.ts`.

Current nav at `< 768px`: the horizontal bar shrinks but items overflow or wrap poorly. There is no mobile-specific nav.

## Goals / Non-Goals

**Goals:**
- Replace the desktop nav links with a hamburger on screens < 768px
- Full-screen overlay on hamburger tap showing curated mobile items only
- "Neuer Termin" CTA button styled with indigo background + white text (same as `navBtnCss` in `main-nav.tsx`)
- "Einstellungen" / "Anmelden" / "Abmelden" as plain nav links
- All items auth-gated appropriately (Neuer Termin & Einstellungen hidden when logged out, Anmelden hidden when logged in, Abmelden hidden when logged out)
- Desktop nav (> 768px) completely unchanged
- Overlay uses instant pop (no animation) with `transform-origin: top right`
- Close overlay on: tapping ✕, tapping backdrop, tapping any nav link, pressing Escape

**Non-Goals:**
- Bottom tab bar or slide-out drawer
- Showing desktop nav items (Home, Termine, Listen, KI, Admin, etc.) on mobile
- Animations or transitions on the overlay
- User email display in the overlay
- Changing the desktop nav in any way

## Decisions

1. **Full-screen overlay, not drawer or dropdown** — gives curated items room to breathe; no competing background content.

2. **`transform-origin: top right`** — visually anchors the overlay to the hamburger button position, making the relationship between trigger and content obvious. No transition used now, but the origin is set for future animation adopters.

3. **Instant pop (no transition)** — the user requested no animation. The overlay toggles via `display` or a class toggle with zero transition.

4. **`clientEntry` pattern for toggle** — follows the proven `theme-toggle.tsx` pattern: register a DOM click listener once, toggle `.is-open` class on the overlay. No framework state needed.

5. **CSS media query at 768px** — consistent viewport breakpoint. Below: hamburger visible, desktop links hidden. Above: desktop links visible, hamburger + overlay hidden.

6. **Mobile data lives in `nav.ts`** — alongside `NAV_SECTIONS`, for testability and single source of nav data.

7. **"Neuer Termin" as CTA** — styled exactly like the desktop login button (`navBtnCss`: indigo 600 bg, white text, font-weight 600, rounded, hover darkens). This is the primary mobile action.

## Component Architecture

```
 ┌─────────────────────────────────────────┐
 │              main-nav.tsx                │
 │                                          │
 │  header                                  │
 │    nav-inner                             │
 │      logo-group                          │
 │      nav-links (desktop)  ← hidden on mobile │
 │      hamburger-btn        ← shown on mobile  │
 │      theme-toggle                         │
 │                                          │
 │    nav-overlay                    ← toggled │
 │      overlay-header (logo + ✕)         │
 │      overlay-body                      │
 │        CTA: Neuer Termin              │
 │        link: Einstellungen            │
 │        link: Anmelden / Abmelden      │
 └─────────────────────────────────────────┘
```

## Data Flow

```
nav.ts                       main-nav.tsx                    nav-toggle.tsx
  MOBILE_ITEMS ──────────→    reads items                    (clientEntry)
                              renders based on auth state     ┌──────────────┐
                              gets csrf for logout form       │ tap ☰       │
                              reads user from context          │ → add .is-open
                                                               │ tap ✕/backdrop│
                                                               │ → remove .is-open
                                                               │ tap nav link │
                                                               │ → remove .is-open
                                                               │ press Escape │
                                                               │ → remove .is-open
                                                               └──────────────┘
```

## CSS Strategy

| Element | Desktop (≥ 768px) | Mobile (< 768px) |
|---------|-------------------|-------------------|
| `nav-links` (desktop items + login/logout) | `display: flex` | `display: none` |
| `hamburger-btn` | `display: none` | `display: flex` |
| `nav-overlay` | `display: none` | `display: none` → `.is-open: block` |
| overlay backdrop | none | fixed full-screen, semi-transparent bg |

Overlay CSS:
- Position: fixed, inset: 0, z-index: 200
- `transform-origin: top right`
- Background: `theme.surface.lvl0` (or a semi-transparent overlay)
- Inner content: flex column, centered or top-aligned with padding

## Risks / Trade-offs

- **[Keyboard access] →** Need to handle Escape key to close; focus management (trap focus in overlay when open). Mitigation: Escape handled in clientEntry, focus management deferred to follow-up if needed.
- **[Desktop items hidden on mobile] →** Users on mobile can't navigate to Home, Termine, Listen, KI, or Admin pages from the nav. Mitigation: deliberate choice — mobile nav is intentionally curated. Users can still reach these pages via direct URL entry or bookmarks.
- **[CSRF for logout] →** The logout form in the overlay needs CSRF token, same as desktop. Reuse `getCsrfToken(getContext())` pattern.
