## Why

The top navbar has two icon-only buttons (logout and theme toggle) that lack visual tooltips. While they have `aria-label` for screen readers, sighted users have no way to discover what these icons mean without clicking them or relying on context. Adding tooltips improves discoverability and reduces friction for new users.

## What Changes

- Add CSS-based tooltip to the logout button in the top navbar (close glyph)
- Add CSS-based tooltip to the theme toggle button in the top navbar (🌓 emoji)
- Both tooltips appear on hover and focus, positioned below the icon

## Capabilities

### New Capabilities
- `navbar-tooltips`: Visual tooltip labels for icon-only buttons in the top navigation bar

### Modified Capabilities
- (none — this is a new visual behavior, not a spec-level change to existing capabilities)

## Impact

- `app/ui/layout.tsx` — the two icon buttons gain a tooltip wrapper or tooltip CSS
- No API, dependency, or breaking changes
- Purely additive CSS + markup change
