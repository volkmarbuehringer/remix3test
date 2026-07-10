---
title: 'Audit logging for admin mutation actions'
tags: [audit, logging, admin, security, accountability, database]
created: 2026-05-31
status: active
---

## Problem

Admin mutation actions (create/update/delete users, reset passwords, toggle locks, modify appointments) had no audit trail. Who performed what operation and when was impossible to determine, making it impossible to detect or investigate unauthorized admin actions.

## Solution

### 1. Create the audit_logs table

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at BIGINT NOT NULL
);
```

### 2. Create a logging utility

```typescript
import type { Pool } from 'pg'

export async function logAdminAction(
  pool: Pool,
  entry: {
    admin_user_id: number
    admin_email: string
    action_type: string
    target_type: string
    target_id?: string | number
    details?: Record<string, unknown>
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (admin_user_id, admin_email, action_type, target_type, target_id, details, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.admin_user_id,
      entry.admin_email,
      entry.action_type,
      entry.target_type,
      entry.target_id != null ? String(entry.target_id) : null,
      entry.details ? JSON.stringify(entry.details) : null,
      Date.now(),
    ],
  )
}
```

### 3. Instrument every admin mutation action

After a successful database write (INSERT/UPDATE/DELETE), before the redirect:

```typescript
let auth = context.auth
let authIdentity = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
if (authIdentity) {
  logAdminAction(pool, {
    admin_user_id: authIdentity.id,
    admin_email: authIdentity.email,
    action_type: 'create', // create / update / destroy / password_reset / etc.
    target_type: 'appointment', // the table/resource name
    target_id: newId,
    details: { resource_id, title },
  })
}
```

The `context.auth` is a discriminated union — always check `auth?.ok` before accessing `auth.identity` to satisfy TypeScript's type narrowing.

## Why

Without audit logging, there is no accountability for admin actions. If an admin account is compromised or an admin abuses their privileges, there is no record to investigate. The audit log is write-only (appends only, never modified) and captures the admin's identity, the exact action, the target, and contextual details — enabling forensics, compliance, and anomaly detection.
