## Why

When the user toggles between light and dark mode, all theme-dependent CSS variables change instantly — the page background, text colors, borders, and surfaces all flip at once with no visual transition. The app already has 21 intentional CSS transitions (hover effects, focus states) at a consistent `150ms ease`, but the theme switch itself is abrupt. Adding a single `transition` rule on `<body>` makes the switch feel polished by smoothly fading between theme states, without interfering with any existing element-specific transitions.

## What Changes

- Add a `150ms ease` CSS transition on `background-color` and `color` to the `<body>` element in `app/ui/document.tsx`
- Respect `prefers-reduced-motion` — disable transitions when the user has requested reduced motion
- No JavaScript changes, no class management, no timer logic

## Capabilities

### New Capabilities

No new capabilities — this is a visual polish improvement with no behavioral change.

### Modified Capabilities

None.

## Impact

- **Modified files**: `app/ui/document.tsx` only — one CSS rule added to the body's `mix` style block
- **No behavior changes**: The theme toggle still works identically
- **No element interference**: Body-scoped transition does not affect any of the 21 existing element-specific transitions
- **Accessibility**: `prefers-reduced-motion` is respected
