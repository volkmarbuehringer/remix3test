## 1. Controller — Filter Logic

- [x] 1.1 In `app/actions/admin/users/controller.tsx`, add a numeric check before the ILIKE branch in `filterPredicate`: if `/^\d+$/.test(filter)`, use `{ id: Number(filter) }` as the predicate

## 2. UI — Placeholder Text

- [x] 2.1 In `app/ui/admin-users-page.tsx`, update the search input placeholder from `"Suche nach Name oder E-Mail..."` to `"Suche nach Name, E-Mail oder ID..."`

## 3. Tests

- [x] 3.1 Add a test case in `app/actions/admin/admin-users.test.ts`: calling `?filter=42` returns only the user with `id=42`
- [x] 3.2 Add a test case: calling `?filter=999999` (nonexistent ID) returns an empty result set
- [x] 3.3 Verify existing tests still pass — the change is purely additive and should not break existing filter behavior
