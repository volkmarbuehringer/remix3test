## Why

The `/admin/users` page filter uses a single `?filter=` param for three modes: status toggle (`enabled`/`disabled`) and text search (ILIKE on name/email). When an admin needs to find a specific user by ID — a common admin workflow — they must scroll through pages or guess parts of the name/email. The heuristic to interpret a purely numeric input as an ID lookup is minimal and intuitive.

## What Changes

- **Controller logic** (`app/actions/admin/users/controller.tsx`): When `filter` is purely numeric (matches `/^\d+$/`), use `id = Number(filter)` as the filter predicate instead of the ILIKE name/email search.
- **No UI changes** — the search input and filter tabs remain identical. The placeholder text on the search input should be updated to hint at ID search.
- **Search input placeholder**: Change from `"Suche nach Name oder E-Mail..."` to `"Suche nach Name, E-Mail oder ID..."`.

## Capabilities

### Modified Capabilities

- `admin-users-crud` (existing): The `index` action's filter logic gains an additional predicate mode for numeric ID lookup.

## Impact

- `app/actions/admin/users/controller.tsx` — ~3 lines added to the `filterPredicate` logic
- `app/ui/admin-users-page.tsx` — placeholder text on the search input updated
- No new dependencies, no schema changes, no migration
