# Nutzer Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Nutzer admin table's Actions column with a right-click context menu (Edit, Reset Password, Lock/Unlock, Copy Email, Delete).

**Architecture:** Each `<tr>` gets its own `<menu.Context>` scope with `contextTrigger()` mixin. Actions dispatch via `handleRowAction()` switch in the page component. Two new backend endpoints (reset-password, toggle-lock) plus a hidden delete form per row.

**Tech Stack:** Remix 3 (menu components from `remix/ui/menu`), PostgreSQL, PBKDF2 password hashing

**Spec:** `openspec/specs/nutzer-context-menu/spec.md`

---

### Task 1: Modify Nutzer Page — Remove Actions Column + Add Context Menu

**Files:**

- Modify: `app/ui/admin-nutzer-page.tsx`

- [ ] **Step 1: Add menu imports at top of file**

Insert after the existing imports:

```tsx
import * as menu from 'remix/ui/menu'
import { MenuItem, MenuList, onMenuSelect } from 'remix/ui/menu'
import { CsrfTokenInput } from './csrf-token-input.tsx'
```

Note: `CsrfTokenInput` is already imported? Let me check — if not, add it.

- [ ] **Step 2: Remove Actions column from colgroup**

Change the `colgroup` from 9 columns to 8. Remove the line `col style={{ width: '10%' }} />` (the actions column) and redistribute remaining widths slightly:

```tsx
<colgroup>
  <col style={{ width: '12%' }} /> {/* was 11% — Vorname */}
  <col style={{ width: '20%' }} /> {/* was 18% — Name */}
  <col style={{ width: '24%' }} /> {/* was 22% — Email */}
  <col style={{ width: '11%' }} /> {/* was 10% — Login */}
  <col style={{ width: '8%' }} /> {/* was 7% — Verpfl */}
  <col style={{ width: '6%' }} /> {/* was 5% — Aktiv */}
  <col style={{ width: '6%' }} /> {/* was 5% — Gesp */}
  <col style={{ width: '13%' }} /> {/* was 12% — Letzter Login */}
</colgroup>
```

- [ ] **Step 3: Remove "Aktionen" header from `<thead>`**

Remove the line:

```tsx
<th mix={thSortableStyle}>Aktionen</th>
```

- [ ] **Step 4: Remove unused CSS styles**

Remove these style definitions:

- `tdActionsStyle`
- `smallBtnStyle`

- [ ] **Step 5: Add `handleRowAction` function before the component definition**

Insert before the `AdminNutzerPage` function:

```tsx
function handleRowAction(
  row: NutzerRow,
  event: { item: { name: string; value?: string } },
  offset: number,
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  filter: string | undefined,
) {
  let csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''

  switch (event.item.name) {
    case 'edit': {
      let params = new URLSearchParams()
      params.set('editing', row.n_id)
      params.set('offset', String(offset))
      params.set('sort', sortColumn)
      params.set('order', sortDirection)
      if (filter) params.set('filter', filter)
      window.location.href = '/admin/nutzer?' + params.toString()
      break
    }

    case 'reset-password': {
      if (!confirm(`Passwort für ${row.n_name || row.l_login} zurücksetzen?`)) return
      fetch(`/admin/nutzer/${row.n_id}/reset-password`, {
        method: 'POST',
        headers: { 'X-Csrf-Token': csrfToken },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.password) {
            alert(`Neues Passwort: ${data.password}\n\nBitte dem Nutzer mitteilen.`)
            window.location.reload()
          } else {
            alert('Fehler beim Zurücksetzen des Passworts.')
          }
        })
        .catch(() => alert('Fehler beim Zurücksetzen des Passworts.'))
      break
    }

    case 'lock':
    case 'unlock': {
      let newValue = event.item.name === 'lock'
      fetch(`/admin/nutzer/${row.n_id}/toggle-lock`, {
        method: 'POST',
        headers: {
          'X-Csrf-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locked: newValue }),
      })
        .then((r) => {
          if (r.ok) window.location.reload()
          else alert('Fehler beim Ändern des Sperrstatus.')
        })
        .catch(() => alert('Fehler beim Ändern des Sperrstatus.'))
      break
    }

    case 'copy-email': {
      if (!row.n_email) return
      navigator.clipboard.writeText(row.n_email).catch(() => {
        // clipboard write failed — silently ignore
      })
      break
    }

    case 'delete': {
      let name = row.n_name || row.l_login
      if (!confirm(`${name} wirklich löschen?`)) return
      let form = document.querySelector<HTMLFormElement>(`form[data-delete-id="${row.n_id}"]`)
      if (form) form.submit()
      break
    }
  }
}
```

- [ ] **Step 6: Wrap each table row in `<menu.Context>` with context trigger, remove old Actions cell**

Replace the current `<tr key={row.n_id} mix={rowStyle}>` block (including its children up to `</tr>`) with:

```tsx
<menu.Context label={`Aktionen: ${row.n_name ?? row.l_login}`}>
  <tr key={row.n_id} mix={[rowStyle, menu.contextTrigger()]} data-row-id={row.n_id}>
    <td mix={tdStyle} title={row.n_vorname ?? ''}>
      {row.n_vorname ?? '\u2014'}
    </td>
    <td mix={tdStyle} title={row.n_name ?? ''}>
      {row.n_name ?? '\u2014'}
    </td>
    <td mix={tdStyle} title={row.n_email ?? ''}>
      {row.n_email ?? '\u2014'}
    </td>
    <td mix={tdStyle} title={row.l_login}>
      {row.l_login}
    </td>
    <td mix={tdStyle}>
      <span mix={row.n_verpflichtung ? boolBadgeYes : boolBadgeNo}>
        {boolLabel(row.n_verpflichtung)}
      </span>
    </td>
    <td mix={tdStyle}>
      <span mix={row.l_aktiv ? boolBadgeYes : boolBadgeNo}>{boolLabel(row.l_aktiv)}</span>
    </td>
    <td mix={tdStyle}>
      <span mix={row.l_gesperrt ? boolBadgeYes : boolBadgeNo}>{boolLabel(row.l_gesperrt)}</span>
    </td>
    <td mix={tdStyle} title={row.l_letzte_login ?? ''}>
      {formatTimestamp(row.l_letzte_login)}
    </td>
  </tr>

  <MenuList
    mix={onMenuSelect((event) =>
      handleRowAction(row, event, offset, sortColumn, sortDirection, filter),
    )}
  >
    <MenuItem name="edit">✏️ Bearbeiten</MenuItem>
    <MenuItem name="reset-password">🔄 Passwort zurücksetzen</MenuItem>
    <div role="separator" />
    {row.l_gesperrt ? (
      <MenuItem name="unlock">🔓 Entsperren</MenuItem>
    ) : (
      <MenuItem name="lock">🔒 Sperren</MenuItem>
    )}
    <MenuItem name="copy-email" disabled={!row.n_email}>
      📋 E-Mail kopieren
    </MenuItem>
    <div role="separator" />
    <MenuItem name="delete">🗑️ Löschen</MenuItem>
  </MenuList>

  {/* Hidden delete form for programmatic submission */}
  <form
    method="POST"
    action={`/admin/nutzer/${row.n_id}`}
    data-delete-id={row.n_id}
    style="display:none"
  >
    <CsrfTokenInput />
    <input type="hidden" name="_method" value="DELETE" />
    <input type="hidden" name="_offset" value={String(offset)} />
    <input type="hidden" name="_sort" value={sortColumn} />
    <input type="hidden" name="_order" value={sortDirection} />
    <input type="hidden" name="_filter" value={filter ?? ''} />
  </form>
</menu.Context>
```

Note: Menu separators use `<div role="separator" />` per the Remix menu convention (see menu.test.tsx).

- [ ] **Step 7: Remove `NutzerDelButton` usage from the old actions cell**

Since the Actions column and its `NutzerDelButton`/Edit button are removed, verify that `NutzerDelButton` is no longer imported at the top of the file. If the import remains unused, remove it:

```diff
- import { NutzerDelButton } from '../assets/nutzer-del-button.tsx'
```

- [ ] **Step 8: Run typecheck**

```bash
cd /home/lucky/alpha4/newapp
pnpm run typecheck
```

Expected: Passes (no type errors).

---

### Task 2: Add Reset-Password Backend Endpoint

**Files:**

- Modify: `app/actions/admin-nutzer-controller.tsx`
- Modify: `app/routes.ts`

- [ ] **Step 1: Add route for reset-password in `app/routes.ts`**

```diff
 nutzer: route('nutzer', {
   index: get('/'),
   create: post('/'),
   update: put('/:id'),
   destroy: del('/:id'),
+  resetPassword: post('/:id/reset-password'),
 }),
```

- [ ] **Step 2: Add `hashPassword` import to the controller**

Add at the top of `app/actions/admin-nutzer-controller.tsx`:

```tsx
import { hashPassword } from '../utils/password-hash.ts'
```

- [ ] **Step 3: Add `resetPassword` action to the controller**

Add inside the `actions` object in the `createController` call, after `destroy`:

```tsx
async resetPassword(context) {
  let id = context.params.id
  if (!id) {
    return Response.json({ error: 'Invalid id' }, { status: 400 })
  }

  // Verify user exists and get their l_id
  let result = await pool.query(
    `SELECT n.n_id, n.n_name, n.n_vorname, l.l_id
     FROM nutzer n JOIN login l ON n.n_lid = l.l_id
     WHERE n.n_id = $1`,
    [id],
  )
  if (result.rows.length === 0) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  // Generate 12-char password (mixed case + digits, no ambiguous chars)
  let chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)]
  }

  let hashed = await hashPassword(password)
  await pool.query(`UPDATE login SET l_password=$1 WHERE l_id=$2`, [
    hashed,
    result.rows[0].l_id,
  ])

  return Response.json({ password })
},
```

- [ ] **Step 4: Run typecheck**

```bash
cd /home/lucky/alpha4/newapp
pnpm run typecheck
```

Expected: Passes.

---

### Task 3: Add Toggle-Lock Backend Endpoint

**Files:**

- Modify: `app/actions/admin-nutzer-controller.tsx`
- Modify: `app/routes.ts`

- [ ] **Step 1: Add route for toggle-lock in `app/routes.ts`**

```diff
 nutzer: route('nutzer', {
   index: get('/'),
   create: post('/'),
   update: put('/:id'),
   destroy: del('/:id'),
   resetPassword: post('/:id/reset-password'),
+  toggleLock: post('/:id/toggle-lock'),
 }),
```

- [ ] **Step 2: Add `toggleLock` action to the controller**

Add inside the `actions` object, after `resetPassword`:

```tsx
async toggleLock(context) {
  let id = context.params.id
  if (!id) {
    return Response.json({ error: 'Invalid id' }, { status: 400 })
  }

  let body: { locked?: boolean }
  try {
    body = await context.request.json()
  } catch {
    return Response.json({ error: 'Expected JSON body' }, { status: 400 })
  }

  if (typeof body.locked !== 'boolean') {
    return Response.json({ error: 'Expected boolean "locked" field' }, { status: 400 })
  }

  // Get the login reference
  let nutzerResult = await pool.query(
    `SELECT n_lid FROM nutzer WHERE n_id = $1`,
    [id],
  )
  if (nutzerResult.rows.length === 0) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  let lId = nutzerResult.rows[0].n_lid
  await pool.query(`UPDATE login SET l_gesperrt=$1 WHERE l_id=$2`, [
    body.locked,
    lId,
  ])

  return Response.json({ ok: true, locked: body.locked })
},
```

- [ ] **Step 3: Run typecheck**

```bash
cd /home/lucky/alpha4/newapp
pnpm run typecheck
```

Expected: Passes.

---

### Task 4: Verify with Tests

- [ ] **Step 1: Run existing tests**

```bash
cd /home/lucky/alpha4/newapp
pnpm test
```

Expected: All existing nutzer tests still pass (we changed the UI but the controller actions remain backward-compatible).

- [ ] **Step 2: Run typecheck one final time**

```bash
cd /home/lucky/alpha4/newapp
pnpm run typecheck
```

Expected: Clean.
