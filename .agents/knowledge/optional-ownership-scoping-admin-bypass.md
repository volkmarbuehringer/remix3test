---
name: optional-ownership-scoping-admin-bypass
description: 'Scope DB queries by userId while letting admins bypass by omitting the parameter'
user-invocable: false
origin: auto-extracted
---

# Optional Ownership Scoping with Admin Bypass

**Extracted:** 2026-06-03
**Context:** Adding `user_id` ownership to a multitenant table (`chatlog`) where admin controllers need full access

## Problem

When adding user-ownership scoping to an existing table, admin dashboards still need to see and manage all records across users. A fixed `WHERE user_id = $userId` clause blocks admin access.

## Solution

Make the `userId` parameter **optional** in data-access functions. When provided (regular user), scope the query. When `undefined` (admin context), skip the filter entirely.

### Pattern

```typescript
// Data-layer function — userId is optional
export async function getRecord(id: string, userId?: number): Promise<Row | null> {
  let ownerFilter = userId != null ? sql`AND user_id = ${userId}` : sql``
  let result = await db.exec(sql`SELECT * FROM table WHERE id = ${id} ${ownerFilter}`)
  return result.rows[0] ?? null
}

// User-facing controller — always passes userId
let row = await getRecord(id, getCurrentUser().id)

// Admin controller — omits userId for full access
let row = await getRecord(id) // no userId filter
```

### Key points

- **User controllers** always call `getCurrentUser()` and pass `.id`
- **Admin controllers** (already behind `requireAdmin()`) omit `userId` for unrestricted access
- **Migration** uses `ALTER TABLE ADD COLUMN IF NOT EXISTS user_id` so existing rows get `NULL` and remain admin-visible
- **Foreign key** uses `ON DELETE SET NULL` to preserve conversations when a user is deleted
- **Test files** use a `TEST_USER_ID` constant threaded through all calls

### Inverse consideration

If the admin fragment controller happens to call a scoped function, it could inadvertently restrict admin access to only the admin's own records — check admin fragment controllers individually when applying this pattern.
