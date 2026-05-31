<!-- Context: project-intelligence/newapp/concepts/database-optimization | Priority: high | Version: 1.0 | Updated: 2026-05-14 -->

# Concept: Database Optimization — Indexing & Query Performance

**Core Idea**: Non-destructive index additions and query narrowings for the 5-table PostgreSQL schema. All changes are additive (`CREATE INDEX IF NOT EXISTS`) — no schema migrations, no destructive operations.

---

## Performance Gaps

| Table | Gap | Impact |
|-------|-----|--------|
| `clients` | **Zero indexes** except PK | Every paginated query = full seq scan + explicit sort |
| `workflow_runs` | Two single-column indexes, no composite | `WHERE status='running' ORDER BY created_at DESC` can't use both |
| `chatlog` | `SELECT *` fetches full JSONB `conversation` | KB of JSON transferred per row when only metadata needed |
| `clients` (ILIKE) | `ILIKE '%pattern%'` on name/email | B-tree cannot accelerate mid-string patterns |

---

## Indexing Strategy

### 1. `clients` — indexes for 6 sortable fields

Each paginated sort (`ORDER BY {col} LIMIT 20` in `app/actions/client/controller.tsx`) currently does `Seq Scan → Sort → Limit`. Per-column B-tree enables `Index Scan → Limit` — scanning 20 rows instead of the full table.

```sql
CREATE INDEX IF NOT EXISTS clients_name_idx ON clients (name);
CREATE INDEX IF NOT EXISTS clients_email_idx ON clients (email);
CREATE INDEX IF NOT EXISTS clients_role_idx ON clients (role);
CREATE INDEX IF NOT EXISTS clients_status_idx ON clients (status);
CREATE INDEX IF NOT EXISTS clients_registered_idx ON clients (registered);
```

**ILIKE caveat**: `ILIKE '%pattern%'` can't use B-tree indexes. When no filter param is present (default pagination), the ILIKE clause is absent — indexes handle the sort. For filtered queries, `Seq Scan` is unavoidable without `pg_trgm` GIN indexes (future phase).

### 2. `workflow_runs` — composite (status, created_at)

Existing single-column indexes are never combined. The engine (`app/workflows/engine.ts`) runs `WHERE status = ? ORDER BY created_at DESC` — planner picks one index, then separately filters/sorts the other dimension.

```sql
CREATE INDEX IF NOT EXISTS workflow_runs_status_created_at_idx ON workflow_runs (status, created_at DESC);
```

**EXPLAIN**: B-tree on `(status, created_at)` lets PostgreSQL seek matching status rows and walk them pre-sorted. With `LIMIT n`, stops after `n` rows — partial scan, no sort step.

### 3. `chatlog` — narrow SELECT for list views

`getAllConversations()` in `app/lib/chatlog.ts` always does `SELECT *`. List views typically only need `id, created_at, updated_at`. Add a metadata-only path:

```ts
// app/lib/chatlog.ts — narrow query for list views
export async function listConversationMeta(filter?: string, limit?: number, offset?: number) {
  return db.exec(sql`SELECT id, created_at, updated_at FROM chatlog
    ${filter ? sql`WHERE conversation::text ILIKE '%' || ${filter.trim()} || '%'` : sql``}
    ORDER BY created_at DESC
    ${limit !== undefined ? sql`LIMIT ${limit} OFFSET ${offset}` : sql``}`)
}
```

**Covering index (phase 2)**: `CREATE INDEX ON chatlog (created_at DESC) INCLUDE (id, updated_at)` enables index-only scans for the narrow path.

### 4. `messages` — covering index for JOIN query

Admin messages (`app/actions/admin-messages-controller.tsx`) joins `messages JOIN users` sorted by `created_at DESC`. Existing `messages_created_at_idx` handles sort but `content` and `sender_id` are heap lookups.

```sql
-- Phase 2: if performance degrades
CREATE INDEX IF NOT EXISTS messages_created_at_covering_idx ON messages (created_at DESC) INCLUDE (sender_id, content);
```

---

## Migration Plan

1. **`app/data/setup.ts`** — Add 5 clients indexes + 1 workflow_runs composite after the `clients` table block (~line 98). Each as `await pool.query(...)`, matching existing pattern.
2. **`app/lib/chatlog.ts`** — Add `listConversationMeta()` as new export. Update callers in list views to use it instead of `getAllConversations()`.
3. **Verify** — Run `EXPLAIN ANALYZE SELECT * FROM clients ORDER BY name ASC LIMIT 20` before and after. Plan should change from `Seq Scan + Sort` to `Index Scan`.
4. **Future phases** — messages covering index, `pg_trgm` for ILIKE, chatlog covering index.
5. **Rollback**: Comment out lines in `setup.ts`. All additive — no data loss, no revert. `listConversationMeta()` is a new export, doesn't alter existing `getAllConversations()`.

---

## 📂 Codebase References

| File | Optimization |
|------|-------------|
| `app/data/setup.ts` | Add 6 `CREATE INDEX IF NOT EXISTS` statements (5 clients + 1 workflow_runs composite) |
| `app/lib/chatlog.ts` | Add `listConversationMeta()` narrow query; update callers |
| `app/actions/client/controller.tsx` | Beneficiary of clients indexes — 6 sort paths, 2 ILIKE filters |
| `app/workflows/engine.ts` | Beneficiary of workflow_runs composite — filter + sort queries |
| `app/actions/admin-messages-controller.tsx` | Beneficiary of messages covering index — raw JOIN sort |
| `app/utils/pagination.ts` | Uses `limit + 1` pattern — indexes are critical here |

## Related

- [Database Architecture](./database-architecture.md) — Table schemas, CRUD, setup
- [Middleware Chain](./middleware-chain.md) — `loadDatabase()` in stack (7th layer)
- [Client Lab Architecture](./client-lab-architecture.md) — Heavy client queries
- [Pagination/Sort Utils](../lookup/pagination-sort-utils.md) — `paginate()` mechanics
- [Known Issues](../lookup/known-issues.md) — Fragment cache disable
