## Context

The admin appointments page (`app/ui/admin-appointments-page.tsx`) currently renders a table with action buttons (Edit/Delete) in each row's last cell. The Edit button navigates to an inline editing panel via URL parameter; the Delete button submits a `RestfulForm` with `_method=DELETE`.

The app already has a context menu implementation in `app/ui/appointtype-panel.tsx`, but it uses a fragile workaround: a hidden 1×1px trigger element repositioned via synthetic `contextmenu` events with a 100ms timeout. That pattern doesn't scale and is prone to race conditions.

This change converts the admin appointments table to use `menu.contextTrigger()` directly on each `<tr>` element — the correct API usage — and removes the visible button group.

## Goals / Non-Goals

**Goals:**

- Replace visible Edit/Delete buttons in admin appointments table with a right-click context menu
- Use `menu.contextTrigger()` directly on table rows (not via hidden proxy element)
- Preserve all existing functionality: inline edit navigation, DELETE via `methodOverride` middleware
- Carry forward grid state (offset, sort, filter) so context menu actions preserve pagination context
- Keep the pattern clean and scalable for adding future actions (duplicate, copy ID, view details)

**Non-Goals:**

- Not changing the existing `appointtype-panel.tsx` context menu (that's a separate improvement)
- Not adding client-side data fetching or optimistic updates — all mutations remain server-side POST/redirect
- Not converting the entire page to `clientEntry` — only the table rows need interactivity
- Not adding keyboard shortcut support for the context menu

## Decisions

### Decision 1: Apply `menu.contextTrigger()` directly on each `<tr>`

**Why**: The current `appointtype-panel.tsx` workaround creates a single hidden trigger, repositions it, and dispatches a synthetic event. This is fragile, uses `setTimeout` race conditions, and breaks with multiple instances. The `menu.contextTrigger()` mixin is designed to be applied directly to the element that should receive right-clicks. Applying it to the `<tr>` element is the canonical usage per the remix/ui/menu README.

### Decision 2: Keep a hidden RestfulForm for DELETE, submit programmatically on menu selection

**Why**: The existing DELETE path uses `methodOverride()` middleware expecting a POST body with `_method=DELETE` and grid state fields (`_offset`, `_sort`, `_order`, `_filter`). Rather than duplicating the form submission logic or changing the controller to accept JSON DELETE, we keep the existing `RestfulForm` hidden and call `.requestSubmit()` on it from the context menu's "Delete" action. This preserves the exact same server behavior, CSRF protection, and grid state forwarding.

**Alternatives considered**:

- `fetch()` POST with `_method=DELETE`: Works but duplicates CSRF token handling and grid state serialization
- `fetch()` DELETE with JSON body: Requires controller changes to accept JSON, breaking the existing pattern

### Decision 3: `AdminAppointmentsPage` stays a server component; extract a `clientEntry` wrapper for the table rows

**Why**: Only the table rows need `menu.contextTrigger()` interactivity. The page layout, header, filter bar, and pagination are static server content. Extracting just the table into a `clientEntry` component minimizes the client-side surface area. Each `<tr>` inside that `clientEntry` gets `menu.contextTrigger()` applied directly.

**Alternatives considered**:

- Make entire page a `clientEntry`: Unnecessary — only the table rows need event handlers
- Add inline script to handle context: Conflicts with Remix 3 component model

### Decision 4: Right-click on any cell in the row (not just the action cell) opens the context menu

**Why**: A small action button cell is a tiny right-click target. Making the entire row the trigger provides a much larger hit target and is consistent with common data-table context menu UX (Gmail, Jira, etc.).

### Decision 5: Preserve left-click row behavior (no context menu on left-click)

**Why**: Currently clicking on a row doesn't do anything special (only the Edit button in the action cell triggers navigation). The context menu is explicitly a right-click-only interaction. Left-click behavior is unchanged.

## Risks / Trade-offs

| Risk                                                                 | Mitigation                                                                                                                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users may not discover the right-click context menu                  | Keep the action button group visible `@media (hover: hover)` for mouse users; context menu is a power-user shortcut — more buttons can be added later without visual clutter |
| `menu.contextTrigger()` on `<tr>` may conflict with other row events | The `contextmenu` event fires before any click events; `handlePointerDown` already checks `event.button !== 0` to ignore right-clicks                                        |
| Hidden `RestfulForm` could be detected by accessibility tools        | Use `aria-hidden="true"` and `role="presentation"` on the hidden form wrapper                                                                                                |
| Grid state must be available to the clientEntry component            | Pass grid state (offset, sort, order, filter) as data attributes rendered by the server template, read via `JSON.parse` in the clientEntry                                   |
