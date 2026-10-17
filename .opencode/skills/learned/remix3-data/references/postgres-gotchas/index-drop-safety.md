# Index Drop Safety: Proving an Index Is Actually Unused or Redundant

**Extracted:** 2026-09-24
**Context:** A database review recommends dropping an index — or any time
`pg_stat_user_indexes.idx_scan` is 0.

Dropping an index is cheap to reverse but expensive to notice: a needed trigram
index removed from a search path degrades silently. Three checks prevent the two
failure modes seen in this repo.

## 1. `idx_scan = 0` is not proof an index is unused

`idx_scan` is cumulative since the last statistics reset. On a small table the
planner seq-scans and **every** index reads 0, including hot ones. Pair the scan
count with table size:

```sql
SELECT s.relname AS tbl, s.indexrelname AS idx, s.idx_scan,
       c.reltuples::bigint AS est_rows
FROM pg_stat_user_indexes s
JOIN pg_class c ON c.oid = s.relid
WHERE s.schemaname = 'public'
ORDER BY s.idx_scan;
```

A 0 on a handful of rows is **unknown**, not unused; only a 0 on a large,
write-active table is evidence.

## 2. Grep the WHOLE repository, not just the query layer

`users_email_trgm_idx` looked dead from `app/data/`, but the column was searched
elsewhere:

- `app/actions/admin/users/controller.tsx` — `or(ilike('name', …), ilike('email', …))`
- `app/actions/agent-events/handlers/resolve.ts` — `… WHERE name ILIKE $1 OR email ILIKE $1`

`gin_trgm_ops` is what serves a leading-wildcard `ILIKE`; the `users_email_key`
btree does not. Before dropping a trigram index, search all source roots
(actions, controllers, workflows, scripts) for both the **column name** and the
**operator** (`ILIKE`, `LIKE`, `~*`).

## 3. De-duplicate indexes by access method, not just columns

Grouping `pg_index` on `(indrelid, indkey, indexprs, indpred)` reports a `UNIQUE`
btree and a GIN trigram index on the same column as duplicates. They are not.
Include the access method:

```sql
SELECT ca.relname AS idx_a, cb.relname AS idx_b
FROM pg_index a
JOIN pg_index b
  ON a.indrelid = b.indrelid
 AND a.indkey = b.indkey
 AND a.indexrelid < b.indexrelid
 AND coalesce(a.indexprs::text, '') = coalesce(b.indexprs::text, '')
 AND coalesce(a.indpred::text,  '') = coalesce(b.indpred::text,  '')
JOIN pg_class ca ON ca.oid = a.indexrelid
JOIN pg_class cb ON cb.oid = b.indexrelid
WHERE ca.relam = cb.relam;   -- same access method; omitting this is the false positive
```

The one true duplicate here was `api_tokens_token_hash_key` (from
`token_hash ... UNIQUE`) vs `api_tokens_token_hash_idx` (an identical non-unique
btree added by hand). A `UNIQUE` constraint already owns its btree, so never add
a second `CREATE INDEX` on that column.

## Verify after dropping

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = '<table>'
ORDER BY indexname;
```

Re-run the duplicate query (expect 0 rows) and exercise the search once.
