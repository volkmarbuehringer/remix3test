## Context

The `<body>` element in `app/ui/document.tsx` currently has a `mix` style that sets `background-color` and `color` via theme tokens (`themeTokens.surface.lvl0`, `themeTokens.colors.text.primary`). When the user toggles dark mode, these CSS variable references change instantly. The rest of the app's 21 CSS transitions (nav hovers, input focus, button effects) all use `150ms ease` as their standard timing — this change adds the same timing to the body's theme properties.

The body is the natural place for this transition because:
1. It's the root visual element — the page background and default text color are the most perceptible changes
2. It doesn't interfere with any existing element-specific transitions (which are on child elements)
3. The body's background fade visually masks the instant switches of inner elements (cards, buttons, borders)

## Goals / Non-Goals

**Goals:**
- Add smooth `150ms ease` transition on body `background-color` and `color` when theme switches
- Respect `prefers-reduced-motion` by disabling transitions when requested
- Zero interference with existing CSS transitions

**Non-Goals:**
- Not transitioning inner elements (cards, buttons, borders) — they switch instantly but are visually masked by the body fade
- Not changing the theme toggle behavior or adding JS class management
- Not adding a universal `*` transition

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Body only | Avoids overriding any of the 21 existing transitions. Body fade masks inner element switches visually. |
| Timing | `150ms ease` | Matches the codebase's established convention for all existing transitions. |
| Implementation | CSS `transition` property in the `mix` style block | No new files, no new components, no JS changes. One-line addition to existing code. |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` in a `<style>` tag | Standard accessibility practice. A `<style>` tag in `<head>` is the most natural place for global media query overrides. |

Alternatives considered:
- **Class-gated universal transition**: Would require JS class management (addClass → toggle → setTimeout → removeClass), `!important` to override element transitions, and introduces a timer. Over-engineered for a polish change.
- **CSS `@media` prefers-color-scheme**: Not applicable — the app uses its own theme toggle, not OS-level preference.
- **Transition on `<html>`**: Redundant — `<body>` is the visual root.

## Risks / Trade-offs

- **[Low] Inner elements switch instantly**: Cards, buttons, and borders don't smoothly transition. In practice, the body background/text fade creates a luminance transition that makes the instant inner-element switches imperceptible — the eye perceives the overall page change, not the individual element changes.
- **[Low] `150ms` is fast**: At 150ms, the transition is fast enough to not feel sluggish but slow enough to be noticeable. This matches the app's existing convention.
- **[None] No interference with existing transitions**: Body-scoped `transition` only applies to the body element and its direct properties. Child elements' transitions (`.button:hover`, `input:focus`) are completely unaffected.
