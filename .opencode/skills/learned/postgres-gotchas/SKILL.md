---
name: postgres-gotchas
description: "Use when hitting PostgreSQL quirks — idempotent FK alterations, `LIMIT` without `ORDER BY`, locale-dependent error matching in JS, and node-postgres returning int8 as strings."
user-invocable: false
origin: consolidated
---

# PostgreSQL Gotchas

**Consolidated from:** `postgres-idempotent-fk-alteration`, `postgres-limit-without-order`, `postgres-locale-error-matching`

Covers four PostgreSQL pitfalls:
1. Idempotent FK constraint alteration (`ON DELETE` behavior changes)
2. `LIMIT 1` without `ORDER BY` is non-deterministic
3. Locale-dependent error message matching breaking JS libraries
4. node-postgres returning `BIGINT`/`int8` columns as strings

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Changing an existing FK `ON DELETE` behavior in an idempotent migration | `references/idempotent-fk-alteration.md` |
| A test helper or query relying on a "first" or "default" row (`LIMIT 1`) | `references/limit-without-order-by.md` |
| A Postgres library crashing because its error-text regex assumes English | `references/locale-dependent-error-matching.md` |
| A Zod / Mastra `outputSchema` expecting `number` for an `int8`/`BIGINT` column | `references/int8-returned-as-string.md` |

## Core Rules

- **Idempotent FK change**: `DROP CONSTRAINT IF EXISTS`, then re-`ADD` inside a `DO $$` block guarded by `IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)`; `ON DELETE SET NULL` requires the column to be nullable first. Run it under a lock / in one migration transaction.
- **`LIMIT` always travels with `ORDER BY`** (or a filtering `WHERE`); otherwise the row is arbitrary and tests fail intermittently as data accumulates.
- **Error text is locale-dependent**: set `lc_messages = 'en_US.UTF-8'` at the database or connection level so English-matching dependencies work. Session-level `SET` races on pooled clients.
- **`pg` returns `int8`/`BIGINT` as strings, `int4` as numbers**: for date/timestamp/bigint fields accept `z.union([z.number(), z.string()])` (or `z.any()`) instead of `z.number()`, or runtime validation fails with `expected number, received string`.
- **Zod 4 records**: `z.record(keySchema, valueSchema)` — the one-arg `z.record(valueSchema)` is a TS2554.

## When to Use

- Writing idempotent migrations that alter FK `ON DELETE` behavior
- Writing test helpers or queries that rely on a "first" or "default" row
- Debugging intermittent test failures or library crashes caused by Postgres error text
- Any time a Postgres-dependent JS/TS library behaves differently across environments with different locales
- A schema validates at typecheck but fails at runtime on the DB-backed path

## Related Skills

- `mastra-agent` — Mastra agent patterns, including PostgresStore observability and storage-API cleanup
- `database-gotchas` — DDL migrations on a dedicated `pg.Client` and migration checksum-drift recovery (`references/ddl-migration-dedicated-client.md`)
- `postgres-patterns` — general PostgreSQL schema, query, and indexing patterns
