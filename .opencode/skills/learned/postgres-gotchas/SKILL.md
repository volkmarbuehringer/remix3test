---
name: postgres-gotchas
description: 'PostgreSQL gotchas — idempotent FK constraint alterations, LIMIT without ORDER BY, locale-dependent error message matching in JS libraries, and node-postgres returning BIGINT/int8 columns as strings'
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

---

## Part 1: Idempotent FK Constraint Alteration

### Problem

PostgreSQL has no `ALTER TABLE ... ALTER CONSTRAINT ... ON DELETE SET NULL` statement. To change an existing FK's `ON DELETE` behavior, you must drop and recreate the constraint. But in idempotent migrations (using `CREATE TABLE IF NOT EXISTS`), you need to handle both:

1. **Fresh install**: The `CREATE TABLE IF NOT EXISTS` creates the table with the new constraint — the DROP/ADD block must not fail or be redundant.
2. **Existing database**: The table already exists with the old constraint — the DROP/ADD block must replace it.

A naive `DROP CONSTRAINT` followed by `ADD CONSTRAINT` fails on re-run because the ADD tries to create a duplicate constraint.

### Solution

Use this three-step pattern inside a migration that runs under an advisory lock:

```sql
-- Step 1: Drop the old constraint (safe: IF EXISTS)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

-- Step 2: Re-add with new ON DELETE behavior (safe: IF NOT EXISTS)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_id_fkey'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
```

The `DROP CONSTRAINT IF EXISTS` removes the old constraint (or is a no-op on fresh installs). The `DO $$` block guards against double-adding with `IF NOT EXISTS`.

### Full example (fresh install + existing DB)

```sql
-- CREATE TABLE uses the desired constraint for fresh installs
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Make column nullable (required for ON DELETE SET NULL)
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;

-- Idempotent ALTER for existing databases
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_id_fkey'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
```

### Important details

- **`ON DELETE SET NULL` requires a nullable column**: You must `ALTER COLUMN ... DROP NOT NULL` before or after changing the FK, or the SET NULL trigger will fail at runtime.
- **Must run under a lock**: The DROP and ADD should be in a single migration transaction or under an advisory lock to prevent races.
- **Constraint naming**: PostgreSQL names constraints as `{table}_{column}_fkey` by default. Verify the name with `\d {table}` if you're unsure.
- **`ON DELETE CASCADE` → `SET NULL` is the same pattern**: Just change the ON DELETE clause in the ADD statement.

### When to Use

- You need to change an existing FK's `ON DELETE` behavior in a migration
- You're writing idempotent SQL migrations that must work on both fresh installs and upgrades
- You're replacing manual pre-DELETE cleanup queries with database-enforced `ON DELETE SET NULL`

---

## Part 2: `LIMIT 1` Without `ORDER BY` Is Non-Deterministic

### Problem

`SELECT ... LIMIT 1` without an `ORDER BY` clause returns an **arbitrary** physical row from the table, not the first one inserted. The physical order depends on PostgreSQL's internal storage layout and changes as rows are inserted, deleted, updated, or vacuumed.

In test helpers, this manifests as intermittent failures when the helper expects a specific kind of row but gets a different one.

**Real-world example:** `createAuthCookieWithCsrf()` used `SELECT id FROM users LIMIT 1` to find an admin user for tests. After e2e tests accumulated users, it started returning non-admin rows, causing all admin controller tests to fail with 403.

### Solution

Always pair `LIMIT` with `ORDER BY` or a filtering `WHERE`:

```ts
// ❌ Non-deterministic — returns an arbitrary row
let result = await pool.query('SELECT id FROM users LIMIT 1')

// ✅ Deterministic — always returns the first admin
let result = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'])
```

### When to Use

- Tests fail intermittently or only after multiple runs (accumulated test data changes row layout)
- A `LIMIT 1` query is used to find a "first" or "default" row in a test helper
- Admin/role-based tests fail with 403 despite using the correct credentials
- Debugging shows the query returns a different row than expected

---

## Part 3: Locale-Dependent Error Message Matching

### Problem

A dependency (e.g., `@mastra/pg`, TypeORM, Prisma) catches Postgres errors by scanning the English message text:

```ts
function isAlreadyAttachedError(error) {
  return /is already a partition/i.test(error.message)
}
```

If your Postgres server uses a non-English locale (e.g., `de_DE.UTF-8`), the error message arrives as `"ist bereits eine Partition"` instead of `"is already a partition"`. The regex doesn't match, the error passes through uncaught, and the process crashes with an unhandled `42809` error.

### Solution

Set `lc_messages` to English at the connection level. This tells Postgres to return error messages in English regardless of the server's locale.

#### Option A: Database-level default (persistent)

```sql
ALTER DATABASE your_database SET lc_messages = 'en_US.UTF-8';
```

Affects all new connections to that database. Existing connections keep their current locale.

#### Option B: Connection URI parameter (per-connection)

Append `options` to the connection string:

```
postgresql://user:pass@host/db?options=-c%20lc_messages%3Den_US.UTF-8
```

In Node.js with `pg.Pool`:

```ts
const pool = new Pool({
  connectionString: databaseUrl + 
    (databaseUrl.includes('?') ? '&' : '?') + 
    'options=-c%20lc_messages%3Den_US.UTF-8'
})
```

#### Option C: Session-level SET (per-query, not recommended)

```sql
SET lc_messages TO 'en_US.UTF-8';
```

Not recommended for connection pools — creates a race condition if the SET query conflicts with other queries on the same client.

### Verification

Check the current setting:

```sql
SHOW lc_messages;
```

Provoke an error to confirm English output:

```sql
SELECT * FROM nonexistent_table;
-- Should show: ERROR:  relation "nonexistent_table" does not exist
```

### When to Use

- A Postgres-dependent library crashes with an unhandled database error during init
- The crash stack trace shows the library's error-matching regex failed
- Your Postgres `lc_messages` is set to a non-English locale
- The error has a recognizable Postgres error code (e.g., `42809`) but the message text is in a different language

---

## Part 4: node-postgres Returns `BIGINT`/`int8` Columns as Strings

### Problem

node-postgres (`pg`) returns PostgreSQL `BIGINT` (`int8`) columns as **strings**, not numbers. This is a documented driver behavior: Postgres `int8` values can exceed the JS safe-integer range, so `pg` hands them back as a `string` rather than a `number`. `int4` columns still come back as numbers.

This silently breaks any strict numeric validation placed on a field sourced from an `int8` column. The classic, hard-to-spot case is a Zod schema expecting `z.number()` for a timestamp/date field (`created_at`, `updated_at`, `date`, `disabled_at`), e.g. a Mastra `createTool` `outputSchema`:

```ts
// ❌ Typechecks fine, but fails at RUNTIME because the node-postgres value is a
// string like "1705276800000", not a number.
createdAt: z.number().describe('Creation unix ms'),
```

When Mastra's `validateToolOutput` enforces the `outputSchema`, the tool throws `Tool output validation failed ... expected number, received string`. The failure only appears at runtime (not typecheck) and varies by column width — `int4` → number, `int8` → string — so it's easy to misdiagnose as a "data bug."

### Solution

For fields sourced from `int8` columns (bigints, unix-ms timestamps), accept either a number or a string, or use a permissive type when the exact type isn't load-bearing:

```ts
// ✅ Accept both (pg may return string or number depending on column width)
createdAt: z.union([z.number(), z.string()]).describe('Creation unix ms'),
// Or, when the type isn't used for logic:
createdAt: z.any().describe('Creation unix ms'),
```

Also confirm the schema **matches the runtime shape** (required fields present; optional for conditionally-absent ones). A `createTool`'s generic infers the `execute` return from `outputSchema`, so a mismatch — e.g. `z.discriminatedUnion('found', ...)` against `execute` returns with untyped DB-row fields — fails at **typecheck** with TS2322. Prefer a lenient `z.object` with `.optional()` entity fields over a strict discriminated union when the return includes untyped DB rows.

Two related Zod 4 details that surface in the same code:

- `z.record(valueSchema)` is a TS2554; Zod 4 requires `z.record(keySchema, valueSchema)` — use `z.record(z.string(), z.number())`.

### When to Use

- A Zod schema / Mastra `outputSchema` uses `z.number()` for a field sourced from a Postgres `int8`/`BIGINT` column and fails at runtime with `expected number, received string`.
- A tool validates at typecheck but fails at runtime only on the DB-backed path.
- You're building a schema that must tolerate both `number` and `string` for bigint/timestamp fields.

---

## When to Use

- Writing idempotent migrations that alter FK `ON DELETE` behavior
- Writing test helpers or queries that rely on a "first" or "default" row
- Debugging intermittent test failures or library crashes caused by Postgres error text
- Any time a Postgres-dependent JS/TS library behaves differently across environments with different locales

## Related Skills

- `mastra-storage` — Mastra PostgresStore-based observability and storage API usage
- `ddl-migration-dedicated-client` — running DDL migrations on a dedicated `pg.Client`, not the shared pool
- `postgres-patterns` — general PostgreSQL schema, query, and indexing patterns
