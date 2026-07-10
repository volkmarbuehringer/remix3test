## Context

The public `/lists` page has a custom sidebar (`app/ui/lists-layout.tsx`) that displays the authenticated user's lists. Currently there is no way to delete a list from this page — users must navigate to `/admin/lists` (admin-only) to delete. The `deleteList()` function already exists in `app/lib/lists-api.ts` with user-scoping support.

The lists page uses Remix Frames for SPA-like navigation with `X-Remix-Target: lists-content`. Sidebar entries are server-rendered via `renderListsPage()` which passes `sidebarEntries` to the layout.

## Goals / Non-Goals

**Goals:**

- Users can delete their own lists via a delete button in the sidebar
- Delete is scoped to the authenticated user (admins can delete any)
- Confirmation dialog shown before deletion
- Sidebar updates after deletion (deleted list removed)
- Route and action follow existing Remix patterns in this codebase

**Non-Goals:**

- Admin audit logging (already handled by admin delete path)
- Bulk delete or undo functionality
- Deleting list items within a list (existing client-side remove is sufficient)
- Changes to the admin lists page

## Decisions

1. **Route: `post('/:id/delete')` (not `del('/:id')`)**
   - Matches the existing admin lists delete pattern (`post('/:id/delete')`)
   - Works naturally with HTML forms + frame navigation
   - No client-side JavaScript needed beyond the confirmation dialog

2. **Form-based POST with redirect (not JSON API)**
   - Consistent with admin delete and other form-based actions in the codebase
   - After delete, redirect to `/lists` — the frame re-renders with the updated sidebar
   - Avoids client-side state management for sidebar invalidation

3. **Reuse `ConfirmDelete` + `data-confirm` pattern**
   - Already used by admin lists and other delete operations
   - Works with frame-based forms via `rmx-target={frames.listsContent}`

4. **Reuse `deleteList()` from `lists-api.ts`**
   - Already handles user scoping via `userId` parameter
   - Returns `false` when list not found or not owned

5. **Error handling: return `context.json()` for invalid IDs**
   - Consistent with existing `save`/`update` actions in the lists controller
   - Invalid or non-numeric IDs return 400 JSON error

## Risks / Trade-offs

- **Redirect resets sidebar view**: After deletion, the user lands on the lists index (Neue Liste view) rather than the deleted list's detail page. Since the list no longer exists, this is correct behavior.
- **No undo**: Deletion is immediate with no confirmation beyond the dialog. Acceptable given the existing admin delete has the same pattern.
- **CSRF**: The form must include `CsrfTokenInput`. Already available in the codebase and used by all mutation forms.
