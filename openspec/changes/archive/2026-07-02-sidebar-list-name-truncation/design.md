## Context

The sidebar in `app/ui/lists-layout.tsx` renders a list of user-created lists as `<NavLink>` entries. Each entry displays a `<span>` with the list name (`entry.label`). The sidebar panel is 220px wide. Long list names overflow because the `<span>` has no truncation styles.

The app already has:

- A consistent CSS truncation pattern: `overflow: 'hidden'`, `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'` — used in ~10 places across admin tables, panels, and inline cells
- A CSS-only `tooltipAnchorStyle` mixin in `app/ui/layout.tsx` (lines 277-309) that shows a `data-tooltip` attribute on hover with a 0.3s delay
- Both `title` attribute and `data-tooltip` patterns in use throughout the app

## Goals / Non-Goals

**Goals:**

- Truncate overflowing sidebar list names with an ellipsis
- Show the full list name on hover via the existing `data-tooltip` CSS tooltip
- Keep the fix minimal — one file change in `app/ui/lists-layout.tsx`

**Non-Goals:**

- No changes to sidebar layout, navigation, drag-and-drop, context menus, or delete buttons
- No new CSS utility or component — reuse existing patterns
- No changes to the native HTML `title` attribute approach (the `data-tooltip` CSS tooltip is already available and preferred for consistency)

## Decisions

### Use existing `tooltipAnchorStyle` over native `title` attribute

The CSS `data-tooltip` tooltip (`tooltipAnchorStyle` in `layout.tsx`) is already defined and provides consistent styling with the app's design system (surface colors, font size, border radius, delay). Native `title` attributes are unstyled and vary by browser. Using `data-tooltip` also keeps the tooltip pattern consistent for future sidebar tooltips.

### Inline `truncateStyle` mixin over a shared utility

The truncation pattern is simple (3 CSS properties) and the app currently defines it inline where needed rather than extracting a shared mixin. Following existing convention avoids unnecessary abstraction.

### `data-tooltip` always set, not conditionally

Setting `data-tooltip` unconditionally simplifies logic and avoids a runtime check. The tooltip CSS only shows on hover, so a non-overflowing name with a matching tooltip causes no harm.

## Risks / Trade-offs

- **[Low] Tooltip visibility on very short names**: Names shorter than the sidebar width won't overflow, but will still show a tooltip on hover. This is acceptable — the tooltip is non-intrusive (0.3s delay) and matches the full name anyway.
- **[Low] CSS tooltip positioning**: The tooltip appears below the nav link. On the bottom-most sidebar entries, the tooltip might extend beyond the viewport. This is an existing property of `tooltipAnchorStyle` and not introduced by this change.
