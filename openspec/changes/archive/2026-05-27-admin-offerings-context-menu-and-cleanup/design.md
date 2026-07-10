## Context

Two admin pages — offerings and appointments — share the same table pattern: sortable columns, pagination, inline editing, and action buttons per row. The appointments page already has a context menu (from a prior change) but still displays the old Edit/Delete glyph buttons. The offerings page has no context menu at all.

This change:

1. Adds a context menu to the offerings page following the exact same pattern as `admin-appointments-context-menu.tsx`
2. Removes the now-redundant action buttons from the appointments page

## Goals / Non-Goals

**Goals:**

- Add right-click context menu to admin offerings table with Edit and Delete actions
- Remove the Edit/Delete glyph button group from admin appointments table (the context menu is now the sole action mechanism)
- Remove unused CSS mixins from appointments page (`actionCellStyle`, `btnGroupStyle`, `editBtnStyle`, `delBtnStyle`)
- Adjust appointments table `colgroup` to redistribute the freed action column width

**Non-Goals:**

- Not adding extra actions beyond Edit/Delete to the offerings context menu (config, add-week remain as toolbar buttons)
- Not changing the controller logic on either page
- Not retrofitting the offerings delete to use `.requestSubmit()` if it already works via form (it already uses RestfulForm)

## Decisions

### Decision 1: Reuse the appointments context menu pattern for offerings

**Why**: The offerings page has the exact same table structure as appointments — sort/filter/paginate/inline-edit. The `admin-appointments-context-menu.tsx` pattern (hidden trigger with `opacity:0`, event delegation on table container, `data-delete-form` for form submission) fits perfectly with zero changes needed to the controller.

### Decision 2: Remove appointments action buttons entirely (not just hide them)

**Why**: The spec previously said "keep buttons visible on hover devices for discoverability." Now that multiple admin pages use context menus (nutzer, appointtype, appointments), users should reliably discover the pattern. Keeping the buttons wastes horizontal space and creates a maintenance burden — every new action needs to be added in two places.

### Decision 3: Redistribute the freed column width in appointments table

**Why**: The action column was 100px wide. Removing it leaves a gap. The remaining columns should fill the space proportionally by removing the explicit `width: 100px` from the last `<col>` and letting the table's `table-layout: fixed` redistribute.

### Decision 4: Keep offerings toolbar buttons for Config and Add Week

**Why**: Config and Add Week are bulk/global actions that don't belong in a per-row context menu. They remain as toolbar buttons. The context menu handles only per-row actions (Edit, Delete).

## Risks / Trade-offs

| Risk                                                                                          | Mitigation                                                                                                                                            |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Removing appointments action buttons may confuse users accustomed to visible buttons          | The context menu already exists and has been working; this only removes the redundant visual duplicate                                                |
| Offerings context menu may not trigger if the row's `oncontextmenu` is intercepted by browser | Already prevented via `event.preventDefault()` in the event delegation handler                                                                        |
| Column width redistribution may cause visual shift                                            | `table-layout: fixed` distributes remaining width proportionally; the freed 100px spreads across 8 remaining columns (~12px each) — barely noticeable |
