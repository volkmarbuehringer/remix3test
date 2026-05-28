<!-- Context: project-intelligence/newapp/errors/appointment-phase1-limitations | Priority: medium | Version: 1.0 | Updated: 2026-05-26 -->

# Error: Appointment Calendar — Phase 1 Limitations

**Severity**: 🟡 Medium

## Layout Scrollbar + Sticky Grid Conflict

`<Layout>` sets `overflowY: auto` on `pageStyle`. The sticky grid header and sidebar depend on this. Sticky `top` values differ between grid header (0) and sidebar (`theme.space.lg`) in the same scroll context. Works currently but may break if overflow behavior changes.

## Page Reload on All Mutations

All three mutations (create, rename, delete) call `window.location.reload()`. Full reload resets scroll, causes flash, prevents smooth inline updates.

**Fix**: Use Frame-based fragment swapping.

## Delete Has No Confirmation

Dragging a block onto the trashcan zone triggers DELETE immediately — no confirmation dialog. Accidental drops cause data loss.

## Pointerdown-vs-Blur Race

Buttons use `pointerdown` (not `click`) to mitigate blur race on textarea focus. Works but unconventional.

## Hardcoded Year Range

Years hardcoded to `[2026, 2027, 2028, 2029, 2030]` in `appointment-sidebar.tsx`. Users cannot navigate outside this range.

## Exclusion Constraint Test Isolation

Each test must use unique time slots (sequential start times: 480, 540, 600...) to avoid `no_overlapping_seats` violations.

## No Frame Integration

Unlike client lab CRUD, appointment calendar is a single clientEntry page with no Frame wrappers. Prevents fragment-level updates.
