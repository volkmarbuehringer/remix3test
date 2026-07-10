---
name: postgres-idempotent-fk-alteration
description: 'Idempotent ON DELETE SET NULL FK migration for PostgreSQL'
user-invocable: false
origin: auto-extracted
---

# Idempotent FK Constraint Alteration in PostgreSQL

**Extracted:** 2026-06-16
**Context:** Migrating existing FK constraints from `ON DELETE RESTRICT`/`NO ACTION` to `ON DELETE SET NULL` in an idempotent migration that works on both fresh installs and existing databases.

## Problem

PostgreSQL has no `ALTER TABLE ... ALTER CONSTRAINT ... ON DELETE SET NULL` statement. To change an existing FK's `ON DELETE` behavior, you must drop and recreate the constraint. But in idempotent migrations (using `CREATE TABLE IF NOT EXISTS`), you need to handle both:

1. **Fresh install**: The `CREATE TABLE IF NOT EXISTS` creates the table with the new constraint — the DROP/ADD block must not fail or be redundant.
2. **Existing database**: The table already exists with the old constraint — the DROP/ADD block must replace it.

A naive `DROP CONSTRAINT` followed by `ADD CONSTRAINT` fails on re-run because the ADD tries to create a duplicate constraint.

## Solution

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

## When to Use

- You need to change an existing FK's `ON DELETE` behavior in a migration
- You're writing idempotent SQL migrations that must work on both fresh installs and upgrades
- You're replacing manual pre-DELETE cleanup queries with database-enforced `ON DELETE SET NULL`
