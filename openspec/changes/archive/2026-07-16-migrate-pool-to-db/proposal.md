## Why

The app has two ways to query the database: `db.*` (typed data-table abstraction from `remix/data-table`) and raw `pool.query()` (raw SQL via `pg`). Of the ~40 raw queries in Mastra tools and workflows, ~30 are simple CRUD+JOIN patterns that `db.*` can express natively. The raw `pool.connect()` pattern is:

1. **More verbose** — acquire client → query → release, with try/finally boilerplate
2. **Not type-safe** — raw SQL returns `any[]`, no column-level type checking
3. **Inconsistent** — some workflows already use `db`, others use `pool`, same team context
4. **Harder to test** — raw queries bypass data-table's migration/seed lifecycle

## What Changes

Replace `pool.connect()` / `client.query()` / `client.release()` with `db.*` calls in Mastra tools and workflows where the SQL pattern is expressible via the data-table query builder.

The files to change:

| File | Raw queries | Migrate to db.* | Must stay raw |
|---|---|---|---|
| `app/actions/mastra/tools/support-tools.ts` | ~25 | ~22 | 3 (GROUP BY + computed ORDER BY, self-referencing UPDATE) |
| `app/actions/mastra/tools/customer-tools.ts` | ~7 | ~6 | 1 (computed rank with dynamic OR'd ILIKE) |
| `app/actions/mastra/tools/route-find-list.ts` | ~3 | 0 | 3 (jsonb_array_elements + EXISTS subquery) |
| `app/actions/mastra/workflows/booking-reminder-workflow.ts` | ~2 | 2 | 0 |
| `app/actions/mastra/workflows/customer-booking-workflow.ts` | ~2 | 2 | 0 |

Queries that must stay as `db.exec(sql\`...\`)`:
- GROUP BY with computed aggregate aliases (`count(*)::int AS count`)
- Computed ORDER BY expressions (`CASE WHEN ... THEN ... END AS rank`)
- `jsonb_array_elements` with `EXISTS` subquery
- Self-referencing UPDATE (`SET col = col + 1`)
- All DDL (CREATE TABLE, ALTER TABLE, etc. — `migrate.ts` stays unchanged)

## Non-Goals

- Not touching `app/data/migrate.ts` — DDL stays on raw pool
- Not touching `app/data/seed.ts` — already uses `db` for most operations
- Not touching `app/data/connection.ts` — pool still needed for migrate, Mastra storage, and the few remaining raw queries
- Not changing any business logic — pure mechanical query migration
