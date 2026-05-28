## 1. Database Indexes

- [x] 1.1 Add `pg_trgm` extension creation and GIN indexes to `app/data/setup.ts` in the `lists` table creation block

## 2. Controller — Filter Logic

- [x] 2.1 Add `filter` query param parsing to the index action, with raw SQL query using `ILIKE` on `description` and `jsonb_array_elements()` with `ILIKE` on `list->>'label'`
- [x] 2.2 Preserve `filter` param in pagination links (prevOffset/nextOffset redirect state)
- [x] 2.3 Preserve `filter` param in destroy action redirect

## 3. Page Component — Filter Form

- [x] 3.1 Add filter form (`<form method="GET" action="/admin/lists" rmx-target="...">`) with text input and submit button to `AdminListsPage`
- [x] 3.2 Add "Clear" link when filter is active
- [x] 3.3 Pass `filter` prop through from controller to component, display current filter value in input

## 4. Controller — Create Index Action (if none exists)

- [x] 4.1 Ensure the admin lists controller exists and is registered in the router (it currently is — `admin-lists-controller.tsx` exists in the tree)

## 5. Tests

- [x] 5.1 Extend `app/actions/lists-controller.test.ts` with filter tests for: filter by description, filter by item label, case-insensitive match, empty filter, no matches empty state, filter input value, clear link, pagination filter preservation

## 6. Verify

- [x] 6.1 Run `tsc --noEmit` — zero errors
- [x] 6.2 Run `pnpm test` — all 355 tests pass
