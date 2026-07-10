---
name: idor-scope-write-bypass
description: 'When adding user_id ownership scoping to fix an IDOR, check for unscoped write paths that SET the owner column — they create a bypass'
user-invocable: false
origin: auto-extracted
---

# Ownership-Claim Write Bypass During IDOR Fixes

**Extracted:** 2026-07-01
**Context:** Adding ownership scoping (user_id/uploaded_by/created_by) to fix a horizontal privilege escalation IDOR

## Problem

You add ownership scoping to READ queries to fix an IDOR — e.g. changing `SELECT ... WHERE id = $1` to `SELECT ... WHERE id = $1 AND user_id = $2`. But a pre-existing unscoped WRITE query that **sets the owner column** (`UPDATE ... SET user_id = $1 WHERE id = $2`) lets any authenticated user claim ownership of any row by id, then read it through the newly-scoped path.

The two-request exploit:

1. `POST /resource file=42` → unscoped UPDATE sets `uploaded_by = attacker.id WHERE id = 42`
2. `GET /resource/42/download` → scoped SELECT returns the file (`WHERE id = 42 AND uploaded_by = attacker.id`)

## Root Cause

The ownership-claim UPDATE was originally written as a post-insert association step (e.g. file uploaded → row created with `user_id = null` → UPDATE sets the owner). When the UPDATE is unscoped, it works for the normal flow (user claims their own just-created row) but can also be called with **any** row id, hijacking existing data.

## Solution

Scope the ownership-claim UPDATE so it can only claim orphan rows or rows the user already owns:

```sql
UPDATE uploads
SET uploaded_by = $1
WHERE id = $2
  AND (uploaded_by IS NULL OR uploaded_by = $1)
```

For DELETE and UPDATE scoping, ensure the WHERE clause includes the owner column on **every** data-access path:

```ts
// Before (bypassable):
let existing = await db.findOne(table, { where: { id } })
await db.delete(table, { id })

// After (scoped):
let where = { id, user_id: userId }
let existing = await db.findOne(table, { where })
await db.delete(table, where)
```

## When to Use

- You are fixing an IDOR by adding `user_id`/owner-column scoping to READ queries
- A controller has a state-changing action that SETS the owner column (typically a post-insert association UPDATE)
- The UPDATE takes the row `id` from user-controlled input (form field, query param, URL param)

## Further Reading

The code review that found this bypass in practice: `app/actions/uploads/controller.tsx` — the `UPDATE uploads SET uploaded_by` was left unscoped while the download/index queries were scoped.
