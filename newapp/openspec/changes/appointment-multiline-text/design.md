## Context

The appointment calendar at `/appointment` renders blocks in a weekly CSS grid. Each block shows the appointment title inside a `<span>` with `display: -webkit-box; -webkit-line-clamp: 2; overflow: hidden`. Titles are edited inline via `<textarea rows={2}>` (the rename pattern).

Two gaps exist:

1. **Display**: The title span lacks `white-space: pre-wrap`, so `\n` characters stored from textarea editing are collapsed to spaces. The hover expansion (`expandedTitleStyle`) removes the line clamp but keeps `display: -webkit-box`, which can cause wrapping issues in some browsers. The tooltip has the same `white-space` gap.

2. **Draft creation**: The new-appointment draft uses `<input type="text">` — single line only. It auto-saves on blur with a full page reload. No way to enter multiline content during creation, unlike the rename flow which supports it. No explicit save/cancel controls.

## Goals / Non-Goals

**Goals:**
- Stored `\n` characters in appointment titles render as visible line breaks in all display contexts (block, hover-expanded, tooltip)
- New appointment drafts support multiline input via textarea
- Draft blur cancels instead of auto-saving (prevents accidental creation)
- Draft has explicit Save + Cancel buttons alongside keyboard shortcuts

**Non-Goals:**
- No change to the rename/edit experience (already uses textarea with Shift+Enter save, blur auto-save — that stays as-is)
- No change to server-side validation (`maxLength(80)`) or data layer
- No Frame-based fragment updates (still uses `window.location.reload()` on save — Phase 1 limitation)
- No edit buttons on the rename pattern (only draft gets buttons)

## Decisions

### D1: Rename flow homogenized with draft

Both the draft (create) and rename (edit) flows now share identical UX:

| Aspect | Rename (after change) | Draft (after change) |
|--------|----------------------|----------------------|
| Blur | Cancel (discard) | Cancel (discard) |
| Save trigger | Shift+Enter, Save button | Shift+Enter, Save button |
| Cancel trigger | Escape, Cancel button, blur | Escape, Cancel button, blur |
| Buttons | Save + Cancel | Save + Cancel |

**Rationale**: The user explicitly requested homogenization. Both flows have the same stakes — accidental saves are equally undesirable in both contexts. Consistent behavior reduces cognitive load.

**Deviation from initial design**: The initial proposal (see D1 earlier in this section) planned to keep rename blur as auto-save. This was updated during implementation per user request.

### D2: `expandedTitleStyle` switches to `display: block`

The current hover expansion only unsets `-webkit-line-clamp` but keeps `display: -webkit-box`. Without a clamp value, `-webkit-box` can still constrain or misbehave with multiline content (it's a legacy flex-like display mode). Switching to `display: block` on hover gives reliable wrapping behavior.

Safe because `expandedTitleStyle` is only applied during hover (transient state), not the default layout.

### D3: Draft block min-height raised to 84px

84px accommodates:
- 2 rows of textarea text (~32px) + padding (~10px top/bottom)
- Buttons row (~24px)
- Gap between textarea and buttons (~4px)

If the appointment duration produces a taller block (e.g., 2-hour slot = 80px → already close), the max of the two values applies.

### D4: Buttons placed below textarea in flex column

The current `draftBlockStyle` uses `display: flex; align-items: center; justify-content: center` — single centered child. Changed to `flex-direction: column; align-items: stretch; gap: 4px; padding: 6px 4px`. The textarea fills the available width, buttons are right-aligned below.

Buttons styled minimally — small text, no heavy borders, matching the provisional dashed-border look of the draft block.

## Risks / Trade-offs

- **[Low] Draft block taller than timeslot**: The draft block overlays adjacent rows via absolute positioning. Visually it may overlap the hour line below. Mitigation: this already happens with the rename textarea, and the draft block has `opacity: 0.85` to signal provisional state.
- **[Low] Cancel-on-blur could lose text**: If a user types multiline content and clicks away reflexively, the draft is discarded. Mitigation: consistent with Escape behavior, and the Save button plus Shift+Enter provide intentional save paths. The current behavior (auto-save + reload) is arguably worse — it creates an appointment the user may not want.
- **[Low] Textarea swallows pointer events**: The `<textarea>` and buttons inside the draft block don't have drag gestures, so no interaction with the grid's pointer system. The existing guard (`event.target instanceof HTMLButtonElement`) already handles button exclusion.
