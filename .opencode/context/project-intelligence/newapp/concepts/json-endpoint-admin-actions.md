<!-- Context: project-intelligence/newapp/concepts/json-endpoint-admin-actions | Priority: medium | Version: 1.0 | Updated: 2026-05-23 -->

# Concept: JSON Endpoint Admin Actions

**Purpose**: Lightweight server actions for admin row operations using POST + JSON body + JSON response — no form submission, no frame lifecycle, no redirect.

---

## When to Use vs Form Actions

| Condition | JSON Endpoint | Form Action |
|-----------|---------------|-------------|
| No form UI (triggered from context menu) | ✅ | ❌ |
| Quick toggles (lock, activate) | ✅ | ❌ |
| Multi-table mutations | ✅ | ✅ |
| CSRF protection | ✅ (header) | ✅ (form field) |
| Works inside Frame | ❌ (full reload) | ✅ (frame.reload) |
| Preserves grid state | ❌ (must reserialize) | ✅ (redirect params) |

---

## Pattern

### Route + Controller Template

```ts
// routes.ts — POST route
resetPassword: post('/:id/reset-password'),

// controller — parse JSON, validate, execute, return JSON
async toggleLock(context) {
  if (!context.params.id) return Response.json({ error: 'Invalid id' }, { status: 400 })
  let body = await context.request.json()
  if (typeof body.locked !== 'boolean')
    return Response.json({ error: 'Expected boolean "locked"' }, { status: 400 })
  let result = await pool.query(
    `UPDATE login SET l_gesperrt=$1 FROM nutzer
     WHERE nutzer.n_lid = login.l_id AND nutzer.n_id = $2`,
    [body.locked, context.params.id],
  )
  if (result.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true, locked: body.locked })
}
```

### Client Call

```ts
let csrfToken = document.querySelector<HTMLMetaElement>(
  'meta[name="csrf-token"]')?.content ?? ''
fetch(`/admin/nutzer/${row.n_id}/toggle-lock`, {
  method: 'POST',
  headers: { 'X-Csrf-Token': csrfToken, 'Content-Type': 'application/json' },
  body: JSON.stringify({ locked: true }),
}).then(r => { if (r.ok) window.location.reload() })
```

---

## Joined UPDATE (Postgres)

```sql
UPDATE login SET l_gesperrt=$1
FROM nutzer
WHERE nutzer.n_lid = login.l_id AND nutzer.n_id = $2
```

The `FROM` clause adds a table to the join scope — equivalent to a subquery but cleaner. Only affects `login` rows matching the join condition.

## Password Reset (crypto.getRandomValues)

```ts
let chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
let randomBytes = crypto.getRandomValues(new Uint8Array(12))
let password = ''
for (let i = 0; i < 12; i++) password += chars[randomBytes[i] % chars.length]
let hashed = await hashPassword(password)
await pool.query(`UPDATE login SET l_password=$1 WHERE l_id=$2`, [hashed, lId])
return Response.json({ ok: true })
```

The password is returned to the caller only via `alert()` — never stored server-side.

---

## 📂 Codebase References

- **Controller**: `app/actions/admin-nutzer-controller.tsx` — `resetPassword`, `toggleLock`, `toggleActive` (lines 301-393)
- **Client call**: `app/assets/nutzer-table-interactive.tsx` — `handleRowAction()` (lines 111-215)
- **Routes**: `app/routes.ts` — `admin.nutzer` tree (lines 79-87)
- **CSRF meta tag**: `app/ui/document.tsx` — `<meta name="csrf-token">`

## Related

- [Admin Context Menu Guide](../guides/admin-context-menu-pattern.md) — Triggers these endpoints
- [Controller Pattern](../guides/controller-pattern.md) — `createController` with typed actions
- [Frame CRUD Pattern](../guides/frame-crud-pattern.md) — Alternative form-based CRUD
