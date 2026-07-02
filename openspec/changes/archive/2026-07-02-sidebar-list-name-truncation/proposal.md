## Why

Long list names in the sidebar overflow the 220px sidebar panel, breaking the layout and making the UI look unfinished. The app already has well-established CSS truncation patterns (`overflow: hidden`, `textOverflow: ellipsis`, `whiteSpace: nowrap`) and tooltip patterns (`data-tooltip` CSS tooltip, `title` attribute), but the sidebar list entries don't use any of them.

## What Changes

- Apply truncation styles to the list name `<span>` in the sidebar navigation entries
- Add a CSS tooltip (`data-tooltip`) on the truncated name so hovering reveals the full name
- No structural or layout changes — the sidebar grid and entry layout remain identical

## Capabilities

### New Capabilities

- `sidebar-list-name-truncation`: Truncation with ellipsis for overflowing sidebar list names, with a hover tooltip showing the full name

### Modified Capabilities

None — this is purely a UI fix within existing components.

## Impact

- **File**: `app/ui/lists-layout.tsx` — add `truncateStyle` mixin and `tooltipAnchorStyle` to the list name `<span>`, and add `data-tooltip` attribute with the full list name
- **No new dependencies** — reuses existing `tooltipAnchorStyle` from `app/ui/layout.tsx`
- **No behavior changes** — existing navigation, drag-and-drop, context menus, and delete buttons are unaffected
