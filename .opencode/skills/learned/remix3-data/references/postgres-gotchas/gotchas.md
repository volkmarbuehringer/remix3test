# PostgreSQL Gotchas

**Source:** consolidated from `postgres-limit-without-order`, `node-postgres-int8-string`, `postgres-locale-error-matching`, `postgres-index-drop-safety`, `postgres-idempotent-fk-alteration`

**Extracted:** 2026-07-01 … 2026-09-24
**Context:** Generic PostgreSQL/driver traps that surface in this app's data layer, migrations, and tests. For Remix data-table deltas see `remix3-data § Data-Table`; for migration/catalog races see `database-gotchas`.

## `LIMIT 1` without `ORDER BY` is non-deterministic

`SELECT ... LIMIT 1` without `ORDER BY` returns an **arbitrary** physical row, not the first inserted. The physical order depends on storage layout and changes as rows are inserted, deleted, updated, or vacuumed.

In tests this looks intermittent: a helper expecting an admin row gets a different one. Real case: `createAuthCookieWithCsrf()` used `SELECT id FROM users LIMIT 1`; after e2e data accumulated it returned non-admin rows and admin controller tests failed with 403.

Always pair `LIMIT` with `ORDER BY` or a filtering `WHERE`:

```ts
// ❌ Non-deterministic
let result = await pool.query('SELECT id FROM users LIMIT 1')

// ✅ Deterministic
let result = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'])
```

## `BIGINT`/`int8` columns come back as strings

The raw-SQL consumption side (wrapping `Number()` around `BIGINT` values from `pool.query`/`db.exec`) is covered by `remix3-data § Database` → `references/database-gotchas/database-errors.md`; this section is the schema/validation side (Zod, Mastra `outputSchema`).

node-postgres returns `BIGINT` (`int8`) as a **string**, not a number, because the value can exceed the JS safe-integer range. `int4` still comes back as a number. This silently breaks strict numeric schemas — the classic case is a Zod/Mastra `outputSchema` expecting `z.number()` for `created_at`/`updated_at`/`date`/`disabled_at`:

```ts
// ❌ Typechecks, fails at runtime: node-postgres gives "1705276800000"
createdAt: z.number().describe('Creation unix ms'),
```

Mastra's `validateToolOutput` then throws `Tool output validation failed ... expected number, received string`. The failure is runtime-only and column-width-dependent, so it is easy to misdiagnose as a data bug.

Decode once at the boundary:

```ts
// ✅ Number everywhere downstream
createdAt: z.coerce.number().describe('Creation unix ms'),
```

In this repo the shared decoder is `int8 = z.coerce.number()` (`app/data/rows.ts`). Use it in raw-SQL wire schemas; the table adapter's `decodeInt8Fields` does the same for typed-API reads, so raw and table reads agree.

Do **not** paper over the split:

- `z.any()` erases the contract, and a `createTool`'s generic infers `execute`'s return from `outputSchema`, so a string/number split ships unnoticed.
- `z.union([z.number(), z.string()])` passes validation but leaves every consumer guessing which branch it received.

Also make the schema match the runtime shape (required fields present, optional for conditionally absent ones). A `createTool` generic infers `execute`'s return from `outputSchema`, so a strict discriminated union against untyped DB-row fields fails at **typecheck** with TS2322; prefer a lenient `z.object` with `.optional()` entity fields.

Two Zod 4 details that surface in the same code:

- `z.record(valueSchema)` is a TS2554; Zod 4 requires `z.record(keySchema, valueSchema)` (e.g. `z.record(z.string(), z.number())`).

## Locale-dependent error matching

Some libraries (e.g. `@mastra/pg`, TypeORM, Prisma) detect Postgres errors by scanning English text:

```ts
function isAlreadyAttachedError(error) {
  return /is already a partition/i.test(error.message)
}
```

On a non-English server (`de_DE.UTF-8`) the message is `"ist bereits eine Partition"`; the regex misses, the error passes through, and the process crashes with an unhandled `42809`.

Set `lc_messages` to English:

**Database default (persistent):**
```sql
ALTER DATABASE your_database SET lc_messages = 'en_US.UTF-8';
```
Affects new connections; existing ones keep their locale.

**Connection URI (per connection):**
```
postgresql://user:pass@host/db?options=-c%20lc_messages%3Den_US.UTF-8
```
```ts
const pool = new Pool({
  connectionString: databaseUrl +
    (databaseUrl.includes('?') ? '&' : '?') +
    'options=-c%20lc_messages%3Den_US.UTF-8'
})
```

**Session `SET lc_messages`** works but is not recommended for pools — it races other queries on the same client.

Verify with `SHOW lc_messages;` and provoke an error (`SELECT * FROM nonexistent_table;` should say `relation "nonexistent_table" does not exist`).

## Dropping an index safely

Dropping an index is cheap to reverse but expensive to notice: removing a needed trigram index degrades silently. Three checks prevent the failure modes seen here.

**1. `idx_scan = 0` is not proof an index is unused.** `idx_scan` is cumulative since the last statistics reset; on a small table the planner seq-scans and every index reads 0. Pair it with table size:

```sql
SELECT s.relname AS tbl, s.indexrelname AS idx, s.idx_scan,
       c.reltuples::bigint AS est_rows
FROM pg_stat_user_indexes s
JOIN pg_class c ON c.oid = s.relid
WHERE s.schemaname = 'public'
ORDER BY s.idx_scan;
```

A 0 on a handful of rows is **unknown**; only a 0 on a large, write-active table is evidence.

**2. Grep the whole repository, not just the query layer.** `users_email_trgm_idx` looked dead from `app/data/`, but `app/actions/admin/users/controller.tsx` and `app/actions/agent-events/handlers/resolve.ts` search the column with `ILIKE`. A `gin_trgm_ops` index serves leading-wildcard `ILIKE`; the btree does not. Search all source roots for the **column** and the **operator** (`ILIKE`, `LIKE`, `~*`) before dropping a trigram index.

**3. De-duplicate by access method, not just columns.** Grouping `pg_index` on `(indrelid, indkey, indexprs, indpred)` reports a `UNIQUE` btree and a GIN trigram index on the same column as duplicates. Include `relam`:

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
WHERE ca.relam = cb.relam;
```

The true duplicate here was `api_tokens_token_hash_key` (from `UNIQUE`) vs `api_tokens_token_hash_idx` (hand-added non-unique btree). A `UNIQUE` constraint already owns its btree; never add a second index on that column.

After dropping, list the table's indexes and re-run the duplicate query (expect 0 rows), then exercise the search once.

## Idempotent FK `ON DELETE` changes

PostgreSQL has no `ALTER TABLE ... ALTER CONSTRAINT ... ON DELETE SET NULL`. Drop and recreate — while keeping the migration safe on both fresh installs (`CREATE TABLE IF NOT EXISTS` already has the new constraint) and existing databases.

```sql
-- Step 1: drop the old constraint (no-op on fresh installs)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

-- Step 2: add only if absent
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_id_fkey'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
```

Details:

- **`ON DELETE SET NULL` requires a nullable column**: `ALTER COLUMN ... DROP NOT NULL` first (or in the same migration), or the SET NULL trigger fails at runtime.
- **Run under a lock**: keep DROP and ADD in one migration transaction or advisory lock to prevent races.
- **Constraint naming**: PostgreSQL defaults to `{table}_{column}_fkey`; verify with `\d {table}`.
- **`ON DELETE CASCADE` → `SET NULL`** uses the same pattern; change only the `ON DELETE` clause.
- **Audit joins after `SET NULL`**: the column is now nullable, so `INNER JOIN` silently drops orphaned historical rows. Use `LEFT JOIN`, make the joined field nullable at the wire/type boundary, add a UI fallback, and add a regression test that deletes the parent and asserts the child still lists with a null parent field.

## When to Use

- A test helper or query relies on a "first"/"default" row (`LIMIT 1`) and fails intermittently.
- A Zod / Mastra `outputSchema` expects `number` for an `int8`/`BIGINT` column and fails at runtime.
- A Postgres library crashes because its error-text regex assumes English.
- A review proposes dropping an index, or `pg_stat_user_indexes.idx_scan` is 0.
- You need to change an existing FK `ON DELETE` behavior in an idempotent migration.
