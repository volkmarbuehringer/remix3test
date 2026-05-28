## Why

Three files hardcode status background/text/border colors for error and success states — but they use different shades of red (`#fef2f2` vs `#fee2e2`) and none of these colors participate in dark mode. The theme has `action.danger.*` for buttons but nothing for status surfaces (banners, alerts, badges). Adding semantic status tokens to the theme eliminates the hardcoding, fixes the inconsistency, and makes status colors switch correctly in dark mode.

## What Changes

- Add `surface.danger` and `surface.success` tokens (each with `bg`, `text`, and `border` sub-values) to both light and dark theme definitions in `app/theme.tsx`
- Replace hardcoded error colors in `layout.tsx` flash messages with theme tokens
- Replace hardcoded error colors in `chat-page.tsx` error state with theme tokens
- Replace hardcoded status colors in `workflow-run-page.tsx` status badges with theme tokens
- Update the showcase theme page (`showcase-pages.tsx`) to display the new surface tokens

## Capabilities

### New Capabilities

- `status-surface-tokens`: Semantic status surface colors for error and success states, with light and dark variants

### Modified Capabilities

None.

## Impact

- **Modified files**: `app/theme.tsx`, `app/ui/layout.tsx`, `app/ui/chat-page.tsx`, `app/ui/workflow-run-page.tsx`, `app/ui/showcase-pages.tsx`
- **No breaking changes**: The `surface` object gains new properties but existing `lvl0-4` tokens are unchanged
- **No visual changes**: New tokens use the exact same color values as the current hardcoded colors (standardized to one shade where there were previously two)
