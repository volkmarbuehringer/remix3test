## Context

The theme (`app/theme.tsx`) defines `action.danger` for interactive elements (buttons) but has no surface-level tokens for status indicators (banners, alerts, badges). Three files hardcode their own status colors:

| File | What | Colors | Dark mode? |
|------|------|--------|------------|
| `layout.tsx` | Error flash banner | `#fef2f2` / `#991b1b` / `#fecaca` | ❌ |
| `layout.tsx` | Success flash banner | `#f0fdf4` / `#166534` / `#bbf7d0` | ❌ |
| `chat-page.tsx` | Error state box | `#fef2f2` / `#991b1b` / `#fecaca` | ❌ |
| `workflow-run-page.tsx` | Failed status badge | `#fee2e2` / `#991b1b` | ❌ |

Note the error surface inconsistency: `#fef2f2` vs `#fee2e2`.

## Goals / Non-Goals

**Goals:**
- Add `surface.danger` (bg/text/border) and `surface.success` (bg/text/border) tokens to both light and dark themes
- Standardize the error surface to `#fef2f2` (matching the majority usage)
- Replace all hardcoded status surface colors in the 3 affected files with theme token references
- Update the showcase page to display the new tokens

**Non-Goals:**
- Not adding status tokens for pending/warning/info states (workflow-run-page's amber and blue badges stay hardcoded — they're only used in one place and are consistent)
- Not restructuring the theme's surface/color architecture
- Not adding a CSS transition for theme switching

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Token naming | `surface.danger.bg` / `.text` / `.border` | Follows the existing `surface` namespace. These ARE surfaces (background regions). Object grouping keeps the 3 values organized. |
| Error surface standard | Use `#fef2f2` (not `#fee2e2`) | `#fef2f2` is used in 2 of 3 locations and is the lighter/more common error tint. |
| Dark mode values | Proportionally darker tints | Dark danger: `#3b1111` / `#fca5a5` / `#7f1d1d`. Dark success: `#052e16` / `#86efac` / `#166534`. |
| Where to add in theme object | After `surface.lvl4`, before `shadow` | Natural grouping — all surface tokens together. |

Alternatives considered:
- **Adding under `colors.status`**: Would separate status surfaces from structural surfaces. Rejected because they're used as backgrounds, making `surface` the more semantically accurate location.
- **Flat strings instead of objects**: `surface.dangerBg`, `surface.dangerText`, etc. Rejected because the object grouping (`{ bg, text, border }`) is more readable and self-documenting.

## Risks / Trade-offs

- **[Low] Object-valued surface property breaks assumption**: If any code assumes `surface` values are always strings (e.g., iterating `Object.values(surface)`), this would break. No such code exists in the codebase — all surface tokens are accessed individually as `theme.surface.lvl1`, etc.
- **[Low] Dark mode colors might need tuning**: The dark mode values are estimated. They'll look reasonable but may need slight adjustments after visual inspection.
