## Context

The top navbar in `app/ui/layout.tsx` renders all nav sections as inline links. The Showcase section currently shows 4 links (Overview, Button, Form, Theme Tokens) with a "Showcase" label. As more showcase pages are added, this will crowd the available space.

The nav data lives in `app/ui/nav.ts` as `NAV_SECTIONS`. The toggle dropdown sits alongside other icon elements (logout, theme toggle).

## Goals / Non-Goals

**Goals:**

- Replace inline Showcase links with a single "Showcase" button that reveals a dropdown menu on click
- The dropdown contains all showcase items as clickable links
- Preserve `NAV_SECTIONS` data structure unchanged
- Keep the dropdown styled consistently with the existing design system
- Show an active/highlighted state on the "Showcase" button when a showcase page is selected

**Non-Goals:**

- Not adding responsive breakpoints or mobile nav (this is a first step toward that, but out of scope)
- Not restructuring the navigation data model
- Not affecting the admin/AI sidebar navigation
- No animation library or third-party dependency

## Decisions

| Decision                 | Choice                                                                                      | Rationale                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigger**              | Click to toggle                                                                             | Hover-based menus are prone to accidental opens on desktop and don't work on touch. Click gives deliberate control.                   |
| **Close behavior**       | Click outside or press Escape closes the dropdown                                           | Standard UX pattern. Clicking a link inside navigates and closes.                                                                     |
| **Client interactivity** | `clientEntry` component (same pattern as `ThemeToggle`)                                     | The existing `app/assets/theme-toggle.tsx` pattern is proven — a small client entry with a click handler. No need for a new approach. |
| **Dropdown styling**     | Dropdown panel with border, shadow, rounded corners, on `z-index` above navbar content      | Matches the existing design language (sidebar panels use similar border/shadow/radius tokens).                                        |
| **Active indicator**     | "Showcase" button gets an active visual state when the current path matches a showcase page | Same pattern as active nav links (`navActiveStyle`).                                                                                  |
| **Dropdown positioning** | Absolute positioned below the button, left-aligned                                          | The button already has `position: relative` through the tooltip style; the dropdown panel sits below it.                              |

**Alternatives considered:**

- **CSS-only `:focus-within` hover menu**: Avoided because it breaks on touch devices and doesn't support click-to-close with Escape.
- **Frame-based navigation**: Overkill for a simple open/close toggle. Client JS is simpler and more responsive.
- **Server-rendered form submission**: Would cause page reloads for every open/close. Not appropriate for a UI toggle.

## Risks / Trade-offs

| Risk                                                   | Mitigation                                                                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Dropdown gets clipped by sticky header or nav overflow | Dropdown uses absolute positioning and `z-index: 200` (above header's `z-index: 100`). Nav container has no `overflow: hidden`.              |
| Click-outside handler conflicts with nav link clicks   | Use `setTimeout` to defer the handler registration after the click event propagates, or check `event.target` is not inside the dropdown.     |
| Dropdown items may grow long over time                 | No action needed — the dropdown panel will scroll naturally if it exceeds viewport height.                                                   |
| Client entry may not mount on server-rendered pages    | The dropdown is progressive enhancement — if JS hasn't loaded, the button is non-functional but the user can still navigate via other links. |
