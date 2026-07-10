## Context

The appointment calendar at `/appointment` currently has a weekly CSS grid (7 days × 24 hours) with click-to-create drafts, double-click rename, and hover delete. All mutations use `fetch()` + `window.location.reload()`. The grid is a `clientEntry()` component at `app/ui/appointment-grid.tsx` (465 lines). The Timeboxer demo at `/home/lucky/remix/demos/timeboxer/` implements full drag-and-drop and resize with a layout solver pure function (`schedule-layout.ts`, 678 lines) — this design adapts those patterns.

## Goals / Non-Goals

**Goals:**

- Users can drag appointment blocks to different days and times with visual ghost feedback
- Users can drag top/bottom block edges to change duration (minimum 15 minutes)
- Collision resolution via cost-based layout solver (no overlapping blocks after drop/resize)
- PUT updates to server with new `date`, `start_min`, `end_min` on drop/release
- Existing interactions (create, rename, delete) continue working unchanged
- Follow existing Remix 3 patterns: `clientEntry()`, `on()` mixin, `handle.update()`, `window.location.reload()` on success

**Non-Goals:**

- No horizontal resize (expand across days)
- No multi-block selection or group drag
- No animation (beyond basic CSS transitions)
- No optimistic UI updates (all mutations reload the page)
- No ICS export or recurring events

## Decisions

| Decision                        | Choice                                                                                                                                      | Rationale                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Layout solver integration**   | Adapted `schedule-layout.ts` from Timeboxer — replaces `dayOfWeek` (0-6) with `date` (epoch ms)                                             | Matches appointment data model. Pure function, no DOM deps. Already battle-tested in Timeboxer.          |
| **Drag implementation**         | Window-level pointer events (`pointerdown`/`pointermove`/`pointerup` on window)                                                             | Pointer capture handles cases where cursor leaves the block. Same pattern as Timeboxer.                  |
| **Grid measurement**            | On drag start, measure grid container's bounding rect with `getBoundingClientRect()`. Compute day width and row height from measured values | Snaps pointer position to grid cells. Accommodates variable-width layouts.                               |
| **Visual feedback during drag** | Ghost block rendered inline with dashed border + opacity; dragged block gets `translate` CSS transform for smooth visual offset             | No layout reflow during drag. Ghost shows target position; transform handles sub-cell offset snapping.   |
| **Resize handles**              | Thin horizontal bars at top/bottom of each block (12px tall, `ns-resize` cursor). Only visible on hover or during active resize             | Matches Timeboxer pattern. Small enough to not obscure content, large enough to grab.                    |
| **Minimum duration**            | 15 minutes, enforced by layout solver policy                                                                                                | Matches existing slot granularity. Consistent with Timeboxer default.                                    |
| **Collision resolution**        | Cost-based algorithm: minimize moved blocks → minimize total distance → minimize natural index distance                                     | Preserves existing block positions as much as possible. Same algorithm as Timeboxer.                     |
| **Mutation strategy**           | PUT with `{ date, start_min, end_min }` partial update. Same `X-Csrf-Token` header. `window.location.reload()` on success.                  | No changes to existing mutation pattern. `updateAppointment` in data layer already accepts these fields. |
| **File structure**              | New `app/ui/schedule-layout.ts` for the pure layout solver. Extend `app/ui/appointment-grid.tsx` for drag/resize UI.                        | Layout solver is a pure function — keeps it testable and separate from UI concerns.                      |

## Risks / Trade-offs

- **[Low] Scroll during drag**: If the user scrolls the page while dragging, pointer coordinates shift relative to the grid. The `Layout` component has `overflowY: auto` on `pageStyle` — the grid header is sticky but the body scrolls. **Mitigation**: Measure grid on drag start (not on every frame). If scroll offset matters, use the grid element's own scroller.
- **[Low] Touch vs pointer**: The existing code doesn't handle touch events. `pointerdown`/`pointermove`/`pointerup` work for both mouse and touch on modern browsers. **Mitigation**: Use `touchAction: 'none'` CSS on block elements to prevent scroll interference on touch devices.
- **[Low] Performance with many blocks**: The layout solver is O(n²) worst-case. **Mitigation**: Realistic grids have <20 blocks per week (same as Timeboxer). Solver is synchronous and completes in <1ms for typical cases.
- **[Low] Concurrent gestures**: A user could start dragging while a draft is active, or resize while a rename is in progress. **Mitigation**: Single active gesture guard (`activeGesture` state) prevents concurrent interactions. Same pattern as Timeboxer.
