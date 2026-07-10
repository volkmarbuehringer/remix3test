# Admin Nutzer Grid

## Problem

The database has two tables — `login` and `nutzer` — with user account data, but there is no admin interface to browse them. An admin needs a read-only grid to view all user records with sorting, filtering, and pagination.

## Design

Add a new admin route `/admin/nutzer` with a server-side rendered table grid that displays the join of `nutzer` and `login`. The grid is read-only, with sortable column headers, a text search filter, and offset-based pagination (no total count query).

### Route

```
/admin/nutzer   GET → index
```

URL params: `?sort=...&order=...&offset=...&filter=...`

### Controller (`app/actions/admin-nutzer-controller.tsx`)

- Middleware: `requireAuth()`, `requireAdmin()`
- Parses `sort`, `order`, `offset`, `filter` from URL
- Builds a parameterized SQL query dynamically:
  - `WHERE` clause: `ILIKE` search across `n_vorname`, `n_name`, `n_email`, `l_login`
  - `ORDER BY`: whitelisted column + direction (SQL-injection safe)
  - `LIMIT` / `OFFSET`: page-based, fetch `pageSize + 1` to detect `hasMore`
- Returns `renderAdminPage()` with the page component

### Page (`app/ui/admin-nutzer-page.tsx`)

Standard SSR `<table>` matching the `admin-lists-page` and `client/grid-page` patterns.

**Columns:**

| Header        | DB column         | Type                | Sortable |
| ------------- | ----------------- | ------------------- | -------- |
| Vorname       | `n_vorname`       | text                | yes      |
| Name          | `n_name`          | text                | yes      |
| Email         | `n_email`         | text                | yes      |
| Verpflichtung | `n_verpflichtung` | boolean badge       | yes      |
| Login         | `l_login`         | text                | yes      |
| Passwort      | `l_passwort`      | masked (`••••••••`) | no       |
| Aktiv         | `l_aktiv`         | boolean badge       | yes      |
| Gesperrt      | `l_gesperrt`      | boolean badge       | yes      |
| Letzter Login | `l_letzte_login`  | timestamp formatted | yes      |

**Filter:** Text input (GET form) that searches across `n_vorname`, `n_name`, `n_email`, `l_login` via `ILIKE`.

**Sort:** Column header links toggle asc/desc. Uses `rmx-target={frames.adminContent}` for frame navigation within the admin sidebar.

**Pagination:** Previous/Next links at the bottom. Preserves sort, order, and filter in URL. Shows "Showing X–Y" range.

**Empty state:** Centered message when no rows match.

### Nav Additions

- **`AdminNavItem`** type: add `'nutzer'`
- **`NAV_GROUPS`**: add `{ id: 'nutzer', label: 'Nutzer', route: routes.admin.nutzer.index }` under "Data" group
- **Nav icon**: generic users/person SVG

## Files

### Created

1. `app/actions/admin-nutzer-controller.tsx` — controller with SQL query + pagination logic
2. `app/ui/admin-nutzer-page.tsx` — SSR table component with sort, filter, pagination UI

### Modified

3. `app/routes.ts` — add `nutzer` route under `adminRoutes`
4. `app/router.ts` — import and map `adminNutzerController`
5. `app/ui/admin-layout.tsx` — add nav item

## Open Questions

None. Design is complete per user requirements.
