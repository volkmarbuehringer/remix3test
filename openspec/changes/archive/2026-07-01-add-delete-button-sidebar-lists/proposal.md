## Why

Users need to delete their own lists directly from the lists sidebar without switching to the admin panel. Currently, there is no delete action available on the public `/lists` page — users must navigate to `/admin/lists` to delete a list, which requires admin privileges and is unintuitive for regular users.

## What Changes

- Add a `DELETE /lists/:id` route and controller action for deleting user-owned lists
- Add a delete button next to each list entry in the sidebar (`lists-layout.tsx`)
- Show a confirmation dialog before deleting (matching the admin delete pattern)
- Update the sidebar after deletion to remove the deleted list
- Add the corresponding route handler to `app/actions/lists/controller.tsx`
- Scope deletion to the authenticated user's own lists (admins can delete any)

## Capabilities

### New Capabilities

- `lists-delete`: Server-side list deletion for the public `/lists` route, scoped to the authenticated user, with proper error handling and sidebar invalidation.

### Modified Capabilities

_(None — no existing spec-level requirements are changing)_

## Impact

- **`app/routes.ts`**: Add `destroy: del('/:id')` to the public `lists` route
- **`app/actions/lists/controller.tsx`**: Add `async destroy(context)` method using `deleteList()` from `lists-api.ts`
- **`app/ui/lists-layout.tsx`**: Add delete button per list entry with confirmation dialog
- **`app/actions/lists/controller.test.ts`**: Add tests for the new destroy endpoint
- **Build output**: Minor increase from new route handler
