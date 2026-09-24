---
name: postgres-gotchas
description: "Use when hitting PostgreSQL quirks — idempotent FK alterations, `LIMIT` without `ORDER BY`, locale-dependent error matching in JS, node-postgres returning int8 as strings, and deciding whether an index is safe to drop (`idx_scan` = 0 is not proof)."
user-invocable: false
origin: consolidated
---

# PostgreSQL Gotchas

**Consolidated from:** `postgres-idempotent-fk-alteration`, `postgres-limit-without-order`, `postgres-locale-error-matching`

Covers five PostgreSQL pitfalls:
1. Idempotent FK constraint alteration (`ON DELETE` behavior changes)
2. `LIMIT 1` without `ORDER BY` is non-deterministic
3. Locale-dependent error message matching breaking JS libraries
4. node-postgres returning `BIGINT`/`int8` columns as strings
5. Judging index liveness/redundancy before dropping one

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Changing an existing FK `ON DELETE` behavior in an idempotent migration | `references/idempotent-fk-alteration.md` |
| A test helper or query relying on a "first" or "default" row (`LIMIT 1`) | `references/limit-without-order-by.md` |
| A Postgres library crashing because its error-text regex assumes English | `references/locale-dependent-error-matching.md` |
| A Zod / Mastra `outputSchema` expecting `number` for an `int8`/`BIGINT` column | `references/int8-returned-as-string.md` |
| A review proposes dropping an index, or `pg_stat_user_indexes.idx_scan` is 0 | `references/index-drop-safety.md` |

## Core Rules

- **Idempotent FK change**: `DROP CONSTRAINT IF EXISTS`, then re-`ADD` inside a `DO $$` block guarded by `IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)`; `ON DELETE SET NULL` requires the column to be nullable first. Run it under a lock / in one migration transaction.
- **`LIMIT` always travels with `ORDER BY`** (or a filtering `WHERE`); otherwise the row is arbitrary and tests fail intermittently as data accumulates.
- **Error text is locale-dependent**: set `lc_messages = 'en_US.UTF-8'` at the database or connection level so English-matching dependencies work. Session-level `SET` races on pooled clients.
- **`pg` returns `int8`/`BIGINT` as strings, `int4` as numbers**: for date/timestamp/bigint fields accept `z.union([z.number(), z.string()])` (or `z.any()`) instead of `z.number()`, or runtime validation fails with `expected number, received string`.
- **Zod 4 records**: `z.record(keySchema, valueSchema)` — the one-arg `z.record(valueSchema)` is a TS2554.
- **`idx_scan = 0` is not evidence an index is unused**: on a small table the planner seq-scans, so every index reads 0 — pair it with the row count, and grep the **whole repo** (not just the query layer) for the column and its `ILIKE`/`LIKE` operators before dropping a trigram index. When de-duplicating, group `pg_index` by access method too (`ca.relam = cb.relam`), or a `UNIQUE` btree and a GIN trigram index on one column look identical; a `UNIQUE` constraint already owns its btree, so a second `CREATE INDEX` on that column is the real redundancy.

## When to Use

- Writing idempotent migrations that alter FK `ON DELETE` behavior
- Writing test helpers or queries that rely on a "first" or "default" row
- Debugging intermittent test failures or library crashes caused by Postgres error text
- Any time a Postgres-dependent JS/TS library behaves differently across environments with different locales
- Reviewing which indexes to keep or drop, or any time `pg_stat_user_indexes.idx_scan` is 0
- A schema validates at typecheck but fails at runtime on the DB-backed path

## Related Skills

- `mastra-agent` — Mastra agent patterns, including PostgresStore observability and storage-API cleanup
- `database-gotchas` — DDL migrations on a dedicated `pg.Client` and migration checksum-drift recovery (`references/ddl-migration-dedicated-client.md`)
- `postgres-patterns` — general PostgreSQL schema, query, and indexing patterns
- `database-reviewer` — the review workflow that surfaces `pg_stat_user_indexes`; apply this reference's caveat before acting on a 0-scan row
