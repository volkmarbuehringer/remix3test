# Ownership-Claim Write Bypass During IDOR Fixes

**Source:** `idor-scope-write-bypass`

**Extracted:** 2026-07-01
**Updated:** 2026-08-04 (a scoped UPDATE is still bypassable when the row id is client-supplied; replaced with a request-scoped claim)

## Problem

You add ownership scoping to READ queries to fix an IDOR — e.g. changing `SELECT ... WHERE id = $1` to `SELECT ... WHERE id = $1 AND user_id = $2`. But a pre-existing unscoped WRITE query that **sets the owner column** (`UPDATE ... SET user_id = $1 WHERE id = $2`) lets any authenticated user claim ownership of any row by id, then read it through the newly-scoped path.

The two-request exploit:

1. `POST /resource file=42` → unscoped UPDATE sets `uploaded_by = attacker.id WHERE id = 42`
2. `GET /resource/42/download` → scoped SELECT returns the file (`WHERE id = 42 AND uploaded_by = attacker.id`)

## Why the obvious fix fails

Scoping the claim UPDATE to `(uploaded_by IS NULL OR uploaded_by = $1)` is not enough. An attacker can POST `file=<victimId>` as a plain TEXT field (not a file part, so the upload handler never runs) and still claim any unclaimed row: the WHERE constrains the owner column, not which row may be claimed. A claim keyed by a client-supplied identifier is the root cause.

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

## Solution: request-scoped claim

Never let the client name the row in a claim step. The server must pass the server-generated id through a request-scoped channel:

1. Add an AsyncLocalStorage scope middleware BEFORE the body parser:
   `uploadClaimScope()` → `storage.run({}, next)`.
2. In the upload handler, after `INSERT … RETURNING id`, call `addUploadedId(id)`.
3. In the post-auth controller, claim only `takeUploadedIds()` — ignore `context.formData.get('file')`.
4. Make `addUploadedId` throw when the scope is missing, so a middleware reorder fails loudly instead of silently producing unclaimable rows.

Remix 3 makes the ordering explicit: `loadAuth()` runs before `formData()`, but route-level `requireAuth()` still runs after it. The handler cannot bind the owner at insert without moving the parser into action middleware; the pre-parse upload guard rejects unauthenticated/cross-origin requests, but ownership is still claimed post-auth.

## When to Use

- You are fixing an IDOR by adding `user_id`/owner-column scoping to READ queries.
- A controller has a state-changing action that SETS the owner column (typically a post-insert association UPDATE).
- The UPDATE takes the row `id` from user-controlled input (form field, query param, URL param).
- A claim step takes an id from client input instead of a server-generated value.

## Further Reading

The code review that found this bypass in practice: `app/actions/admin/uploads/controller.tsx` (app re-checked 2026-10-14: the uploads route moved under `admin/`; the claim UPDATE now lives in `app/data/uploads.ts:289` and is scoped) — the `UPDATE uploads SET uploaded_by` was left unscoped while the download/index queries were scoped. The follow-up review (2026-08-04) found that even the scoped form above is bypassable and replaced the client-supplied-id claim with a server-side request scope (`app/middleware/upload-claim.ts`).
