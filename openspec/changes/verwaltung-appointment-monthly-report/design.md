## Context

The report lives under `/verwaltung/report1` — a sibling of the existing offerings, appointments, resources, and offering-configs pages. It follows the same admin grid pattern: sortable columns, text filter, pagination, and URL-driven state.

## Goals / Non-Goals

**Goals:**

- Add `GET /verwaltung/report1` with year/month pickers and optional user dropdown
- Query `appointments` grouped by user, computing count, first/last date, total hours, avg hours
- Full grid UX: sort by any column, text filter (by user name), pagination
- Follow existing patterns (`grid-state.ts`, `parseSort`, pagination, `pool.query`)

**Non-Goals:**

- No HAVING clause — all users with appointments in that period are shown
- No CSV/PDF export (future concern)
- No live updates — static query result per request

## Decisions

### Route structure

Instead of a nested `route('report1', { index: get('/') })`, use a flat `get('/report1')` under the verwaltung route map, and wire it with a simple `createAction` handler or `router.get()`.

### URL parameter scheme

```
/verwaltung/report1?year=2026&month=6&user_id=42&sort=count&order=desc&offset=0&filter=joh
```

| Param     | Purpose                             |
| --------- | ----------------------------------- |
| `year`    | Required — 4-digit year             |
| `month`   | Required — 1–12                     |
| `user_id` | Optional — filter to one user       |
| `sort`    | Column to sort by (default: `name`) |
| `order`   | `asc` or `desc`                     |
| `offset`  | Pagination offset                   |
| `filter`  | Text search on user name            |

### SQL approach

Use `pool.query()` with dynamic WHERE/ORDER BY/LIMIT/OFFSET, matching the pattern in `loadAppointmentPageData`. The date range is computed from year/month (UTC start of month → start of next month).

```sql
SELECT u.id, u.name, u.email,
       COUNT(*)::int                                AS count,
       MIN(a.date)                                  AS min_date,
       MAX(a.date)                                  AS max_date,
       COALESCE(SUM(a.end_min - a.start_min), 0)    AS total_min,
       ROUND(SUM(a.end_min - a.start_min)::numeric
             / NULLIF(COUNT(*), 0), 1)              AS avg_min
FROM appointments a
JOIN users u ON u.id = a.user_id
WHERE a.date >= $1 AND a.date < $2
  AND ($3::int IS NULL OR a.user_id = $3)
  AND ($4::text IS NULL OR u.name ILIKE $4)
GROUP BY u.id, u.name, u.email
ORDER BY ...
LIMIT $5 OFFSET $6
```

Display values computed server-side:

- `total_hours` = `total_min / 60.0` (rounded to 1 decimal)
- `avg_hours` = `avg_min / 60.0` (rounded to 1 decimal)

### Sorting

Allowed sort columns: `name`, `count`, `min_date`, `max_date`, `total_hours`, `avg_hours`.

The `sort` URL param maps to the SQL ORDER BY expression. For computed columns like `total_hours` and `avg_hours`, use the SUM/ROUND expressions directly in ORDER BY.

### Pagination

Page size: 20 (matching admin list conventions). Same LIMIT + 1 / hasMore pattern as existing pages.

### Grouping users dropdown

Fetch available users from `SELECT id, name FROM users ORDER BY name ASC` (same as the appointments page) to populate a `<select>` with an "All Users" option.

### Reusing patterns

- `renderVerwaltungPage()` for the page shell
- `grid-state.ts` helpers for preserving grid state across form submissions
- `parseSort` from `sort-params.ts` for parsing sort/order params
- `pool.query()` with parameterized SQL

## Risks / Trade-offs

- **Large month data**: If a month has thousands of appointments across many users, pagination keeps it manageable. No risk.
- **Year/month input validation**: Params arrive as strings — validate that year is 1900-2100 and month is 1-12 before passing to SQL.
- **User dropdown stale data**: Same cached 60s TTL approach as the appointments page works here.
