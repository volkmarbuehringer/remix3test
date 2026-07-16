---
name: postgres-locale-error-matching
description: "Fix locale-dependent PostgreSQL error message matching in JS libraries"
origin: auto-extracted
---

# PostgreSQL Locale-Dependent Error Message Matching

**Extracted:** 2026-07-16
**Context:** When a JavaScript/TypeScript library checks PostgreSQL error messages by regex pattern, non-English server locales cause the match to fail silently, turning a handled error into a process crash.

## Problem

A dependency (e.g., `@mastra/pg`, TypeORM, Prisma) catches Postgres errors by scanning the English message text:

```ts
function isAlreadyAttachedError(error) {
  return /is already a partition/i.test(error.message)
}
```

If your Postgres server uses a non-English locale (e.g., `de_DE.UTF-8`), the error message arrives as `"ist bereits eine Partition"` instead of `"is already a partition"`. The regex doesn't match, the error passes through uncaught, and the process crashes with an unhandled `42809` error.

## Solution

Set `lc_messages` to English at the connection level. This tells Postgres to return error messages in English regardless of the server's locale.

### Option A: Database-level default (persistent)

```sql
ALTER DATABASE your_database SET lc_messages = 'en_US.UTF-8';
```

Affects all new connections to that database. Existing connections keep their current locale.

### Option B: Connection URI parameter (per-connection)

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

### Option C: Session-level SET (per-query, not recommended)

```sql
SET lc_messages TO 'en_US.UTF-8';
```

Not recommended for connection pools — creates a race condition if the SET query conflicts with other queries on the same client.

## Verification

Check the current setting:

```sql
SHOW lc_messages;
```

Provoke an error to confirm English output:

```sql
SELECT * FROM nonexistent_table;
-- Should show: ERROR:  relation "nonexistent_table" does not exist
```

## When to Use

- A Postgres-dependent library crashes with an unhandled database error during init
- The crash stack trace shows the library's error-matching regex failed
- Your Postgres `lc_messages` is set to a non-English locale
- The error has a recognizable Postgres error code (e.g., `42809`) but the message text is in a different language
