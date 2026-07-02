## 1. Add rename route to routes.ts

- [x] 1.1 Add `rename: put('/:id/rename')` to the `lists` route group in `app/routes.ts`

## 2. Add renameList to lists-api.ts

- [x] 2.1 Add `renameList(db, id, description, userId?)` function that updates only `description` and `updated_at` on the matching row
- [x] 2.2 Return `boolean` — `false` if not found, `true` on success

## 3. Add rename action to controller

- [x] 3.1 Add `rename` action in `app/actions/lists/controller.tsx` that:
  - Validates `{ description }` with `minLength(1), maxLength(500)`
  - Calls `renameList()`
  - Returns `{ id, description }` on success, `{ error }` on failure

## 4. Create list-name-edit clientEntry component

- [x] 4.1 Create `app/assets/list-name-edit.tsx` with:
  - Invisible `<div>` via `clientEntry()`
  - Capture-phase click interception with 350ms double-click detection
  - Replaces name `<span>` with `<input>`, focuses and selects text
  - Enter/blur: sends `PUT /lists/:id/rename` with CSRF token
  - Escape: cancels and restores original span
  - On success: updates span text, tooltip, delete confirm and aria-label
  - On error: reverts to original

## 5. Wire into lists-layout.tsx

- [x] 5.1 Add `data-list-id` attribute to the entry `<div>` in the sidebar map
- [x] 5.2 Add `data-list-name` attribute to the name `<span>`
- [x] 5.3 Import and render `<ListNameEdit />` inside `<nav>` (next to `<ConfirmDelete />`)

## 6. Verify

- [x] 6.1 Run `npm run typecheck` to confirm no type errors
- [x] 6.2 Run `npm test` to confirm existing tests still pass
