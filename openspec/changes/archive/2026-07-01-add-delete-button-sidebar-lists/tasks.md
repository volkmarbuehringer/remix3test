## 1. Route Definition

- [x] 1.1 Add `destroy: post('/:id/delete')` to the public `lists` route in `app/routes.ts`

## 2. Controller

- [x] 2.1 Add `destroy` action to `app/actions/lists/controller.tsx` using `deleteList()` from `lists-api.ts`, scoped to authenticated user

## 3. Sidebar UI

- [x] 3.1 Add delete form button in `app/ui/lists-layout.tsx` next to each list entry with `data-confirm`, `CsrfTokenInput`, and `rmx-target={frames.listsContent}`

## 4. Tests

- [x] 4.1 Add tests for the new destroy endpoint in `app/actions/lists/controller.test.ts` covering successful delete, non-existent list, another user's list, invalid ID, admin delete

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and `npm test` to verify no regressions
