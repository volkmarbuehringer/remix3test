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

## Update (2026-08-04): Scoped-claim is still bypassable when the id is client-supplied

The scoped UPDATE above is NOT sufficient when the row `id` comes from client input. An
attacker POSTing `file=<victimId>` as a plain TEXT field (not a file) claims any unclaimed
upload even with `(uploaded_by IS NULL OR uploaded_by = $1)` — the WHERE only constrains the
owner column, not which row can be claimed. Scope the read AND never let the client name the
row in a claim step.

Root cause: a claim keyed by a client-supplied identifier. The server must pass the
server-generated id through a request-scoped channel instead.

Fix (Remix 3: `formData()` runs before auth, so the handler can't bind the owner at insert):
1. Add an AsyncLocalStorage scope middleware BEFORE the body parser:
   `uploadClaimScope()` → `storage.run({}, next)`.
2. In the upload handler, after `INSERT … RETURNING id`, call `setUploadedId(id)`.
3. In the post-auth controller, claim only `takeUploadedId()` — ignore `context.formData.get('file')`.
4. Make `setUploadedId` throw when the scope is missing, so a middleware reorder fails loudly
   instead of silently producing unclaimable rows.

## Further Reading

The code review that found this bypass in practice: `app/actions/uploads/controller.tsx` — the `UPDATE uploads SET uploaded_by` was left unscoped while the download/index queries were scoped. The follow-up review (2026-08-04) found that even the scoped form above is bypassable and replaced the client-supplied-id claim with a server-side request scope (`app/middleware/upload-claim.ts`).
