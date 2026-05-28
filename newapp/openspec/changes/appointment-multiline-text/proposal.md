## Why

Appointment titles can contain multiline text (stored with `\n` line breaks), but the UI doesn't render those line breaks — they're collapsed to spaces by the lack of `white-space: pre-wrap`. Additionally, creating new appointments is single-line only (`<input type="text">`), inconsistent with the inline rename experience which uses a multiline `<textarea>`. This creates a gap between what users can enter during edit vs. what they can enter during creation, and what gets stored vs. what gets displayed.

## What Changes

- **Render multiline correctly**: Add `white-space: pre-wrap` to `blockTitleStyle`, `expandedTitleStyle`, and `tooltipStyle` so stored `\n` characters display as line breaks. On hover, switch `expandedTitleStyle` from `display: -webkit-box` to `display: block` to avoid clamp-related wrapping issues.
- **Draft creation becomes multiline**: Replace the single-line `<input type="text">` with a `<textarea rows={2}>` for new appointment drafts. Enter inserts a newline; Shift+Enter submits (matching the inline rename pattern).
- **Cancel on blur instead of auto-save**: Blur outside the draft discards it (no POST). This protects against accidental creation when clicking away mid-edit.
- **Save + Cancel buttons**: Inline buttons in the draft block for explicit save/cancel, complementing the keyboard shortcuts.
- **Draft block minimum height**: Increased from 48px to ~84px to accommodate textarea + buttons comfortably.

## Capabilities

### New Capabilities

None — this is an implementation-level improvement to the existing appointment calendar UI, not a new capability.

### Modified Capabilities

None — no spec-level requirement changes. All changes are UI/UX improvements.

## Impact

**Affected files:**
- `app/ui/appointment-grid.tsx` — CSS changes (3 style blocks), draft input type change, draft event handlers, draft layout, button markup

**No API changes** — the controller and data layer remain untouched. Title validation stays at `maxLength(80)` (can be addressed separately if needed).

**No test changes** — the grid is a clientEntry with no test file. Controller tests unaffected.
