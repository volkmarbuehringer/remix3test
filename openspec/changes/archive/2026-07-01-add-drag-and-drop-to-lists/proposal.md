## Why

List items can currently only be reordered via ↑↓ arrow buttons. Drag and drop provides a more intuitive and efficient reordering experience, especially for moving items across larger distances or to specific positions.

## What Changes

- Add HTML5 drag-and-drop interaction alongside the existing ↑↓ move buttons
- Add a drag handle (grip icon) on each item as the activation zone
- Show a visual drop indicator (placeholder line) while dragging to show where the item will land
- Preserve existing move up/down, reverse, and shuffle buttons as alternatives
- Keep existing data model (order = array index in JSONB) — no schema changes

## Capabilities

### New Capabilities
- `list-item-reorder`: drag-and-drop reordering of items within the lists client, with visual drag feedback and drop target indicators

### Modified Capabilities
- None — no spec-level requirement changes; this is a UX enhancement within existing capabilities

## Impact

- `app/assets/lists-client.tsx` — main changes for drag-and-drop interaction
- No data model changes (list order is already array-index-based)
- No new dependencies (HTML5 native drag and drop, no library)
- No API changes
