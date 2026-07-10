## Why

Validate the inline-editable column pattern on the `/client` grid before adopting it across admin tables. Currently editing any field requires a sidebar form + full round-trip. We want to prove that clicking an email cell turns it into an inline input that saves via fetch — using a single `clientEntry` per page (not per row).

## What Changes

- Add a new `clientEntry` component (`ClientGridInlineEdit`) to the `/client/grid` page
- Email column cells become click-to-edit: click → `<input>` appears inline → Enter/blur saves via PUT → cell reverts to text
- A single `clientEntry` manages all inline edit state via a `Map<rowId, { value, saving }>`
- No per-row `clientEntry` — one component, event delegation on the table
- Backend: a JSON endpoint for updating just the email field (existing PUT route extended to handle partial updates)

## Capabilities

### New Capabilities

- `inline-edit-column`: Click-to-edit cell behavior on the client grid — email column only. Single clientEntry, delegated events, Map-based edit state, fetch-based save with optimistic UI.

### Modified Capabilities

_(none)_

## Impact

- `app/actions/client/grid-page.tsx` — email `<td>` becomes conditional (text vs input) based on edit state
- `app/actions/client/controller.tsx` — update action may need to handle partial (email-only) PUT bodies
- New file: `app/assets/client-grid-inline-edit.tsx` — the `clientEntry` component
- `app/actions/client/grid-page.tsx` — wire the new component into render output with serialized grid state
