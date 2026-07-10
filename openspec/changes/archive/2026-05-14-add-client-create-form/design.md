## Context

The client lab page at `/client` renders a grid of records (via `<Frame>`) and an optional inline edit form in a right column. Currently only Edit and Delete exist — there is no Create path. Adding create completes the CRUD quartet and makes the lab self-contained for demo purposes.

The existing edit pattern:

```
Click "Edit" row action → GET /client/edit/:rowId → 302 /client?editing=N
  → index action loads row → ClientPage renders two-column layout
  → ClientEditPage form in right column
  → PUT /client/:id saves, redirects back
```

The create pattern mirrors this, using a blank form instead of a pre-filled one.

## Goals / Non-Goals

**Goals:**

- Add `POST /client` route for creating new client records
- Add "Add New" button visible on the client page
- Add `?creating=true` query param to open a blank create form in the edit column
- After successful creation, redirect to `?editing=<new-id>` (show the new record in edit mode)
- Share field layout and styling with the edit form

**Non-Goals:**

- No changes to the grid, pagination, sorting, filtering, or edit/delete flows
- No changes to the data schema or database setup
- No standalone create page at a separate URL — always inline via `?creating=true`

## Decisions

### Decision 1: `creating=true` mirrors `editing=N` pattern

The create form reuses the same two-column layout mechanism as the edit form. When `?creating=true` is present in the URL, the `index` action renders the right column with a blank `ClientCreatePage`. The grid remains visible on the left.

**Why:** Consistent with the existing pattern. No new URL structure needed. The cancel button simply removes the query param and returns to single-column view.

### Decision 2: Separate `ClientCreatePage` component

Rather than making `ClientEditPage` accept an optional row, create a distinct `ClientCreatePage` component. It shares the same panel styles and field layout but starts with empty fields and sensible defaults (role: "Viewer", status: "Active").

**Why:** Keeps concerns separate. The create form has no `rowId` badge, different header text, different submit label, and no reliance on `Client` type for existing data. Sharing styles via the existing inline `css` definitions is sufficient.

### Decision 3: "Add New" button placement

The "Add New" button sits in the `ClientPage` component, between the title and the Frame, only visible when neither editing nor creating.

**Why:** It's the natural place — always visible without scrolling into the grid. Hidden during edit/create to reduce clutter while a form is open.

### Decision 4: Redirect to `?editing=<new-id>` after create

After `POST /client` succeeds, redirect to `/client?editing=<new-id>` instead of just `/client`.

**Why:** The edit sidebar is useful for verifying the newly created record was stored correctly. The user can cancel to return to the grid. This matches the save-to-edit pattern used by the existing update action.

## Risks / Trade-offs

- **[Low] `ClientCreatePage` duplicates field markup from `ClientEditPage`** → Acceptable for now. The form is small (5 fields). If another form is added later, extracting a shared field set would be worthwhile.
