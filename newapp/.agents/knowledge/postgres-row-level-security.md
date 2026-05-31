---
title: "PostgreSQL Row-Level Security for multi-tenant data isolation"
tags: [postgres, security, rls, multi-tenant, auth, data-isolation, defense-in-depth]
created: 2026-05-31
status: active
---

## Problem

Multi-tenant apps (users see only their own data) rely entirely on application-level `WHERE user_id = ?` clauses. A single bug — a missing filter, a wrong join, a developer forgetting to scope a query — can leak all users' data. There is no defense at the database level.

## Solution

Enable **Row-Level Security (RLS)** on tenant-scoped tables. RLS attaches policies directly to tables so the database itself enforces data isolation, even if the application query is missing the user_id filter.

### Step 1: Enable RLS on tenant tables

```sql
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
```

`FORCE ROW LEVEL SECURITY` ensures even the table owner is subject to the policy.

### Step 2: Create a policy using the authenticated user ID

PostgreSQL doesn't natively know your app's user IDs. Pass them via `SET LOCAL` in a request-scoped database middleware:

```sql
CREATE POLICY appointments_user_policy ON appointments
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::integer);
```

### Step 3: Set `app.current_user_id` on every authenticated request

In a database middleware, set the parameter before any queries run on that connection:

```typescript
// app/middleware/database.ts — after auth is resolved
if (context.auth?.ok) {
  let userId = (context.auth.identity as User).id
  await pool.query(
    "SET SESSION app.current_user_id = $1",
    [userId]
  )
}
```

Use `SET SESSION` or `SET LOCAL` depending on whether you want it scoped to the transaction or the whole session. `SET LOCAL` is safer — it's scoped to the current transaction and auto-resets on COMMIT/ROLLBACK:

```typescript
await client.query("SET LOCAL app.current_user_id = $1", [userId])
```

### Step 4: Create admin bypass

Admins need to see all records. Create a separate policy or use a role-based check:

```sql
CREATE POLICY appointments_admin_policy ON appointments
  FOR ALL
  USING (
    current_setting('app.current_user_id')::integer = user_id
    OR current_setting('app.is_admin', true) = 'true'
  );
```

## Why

Application-level security has a single point of failure — the application code. RLS adds a **database-level defence layer** that:

- Protects against query bugs (missing WHERE clauses, wrong joins)
- Protects against future code changes that might forget to scope queries
- Works consistently across all access paths (app code, ad-hoc queries, migrations, admin tools)
- Is enforced even if the application is compromised and queries are modified

RLS is not a replacement for application-level authorization — it's **defense-in-depth** that catches what application bugs miss.
