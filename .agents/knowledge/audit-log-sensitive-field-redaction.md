---
title: 'Audit Log Sensitive Field Redaction'
tags: [auth, audit, security, admin]
created: 2026-06-03
status: active
---

## Problem

When logging change objects to `audit_logs` after admin mutations (user create/update), the full changes payload including `password_hash` was written to `details` JSONB. Even though the hash is PBKDF2 (not cleartext), storing it in an auxiliary audit table violates least-privilege and makes it available to anyone with audit read access.

## Solution

Before calling `logAdminAction`, shallow-clone the `changes` object and replace sensitive keys with a sentinel:

```ts
let safeChanges = { ...changes }
if ('password_hash' in safeChanges) {
  safeChanges.password_hash = '***REDACTED***'
}
logAdminAction(pool, {
  ...,
  details: { changes: safeChanges },
})
```

This keeps the audit log useful (you can see _that_ a password was changed) without exposing the hash itself.

## Why

- **Least privilege**: Audit log readers don't need password hashes — they need to know _what_ changed, not the hash value.
- **Blast radius reduction**: If the audit log table is compromised, hashes aren't leakable.
- **General pattern**: Any sensitive field (tokens, API keys, secrets, PII) passed through a `details`/`changes` JSON payload should be redacted before logging.
