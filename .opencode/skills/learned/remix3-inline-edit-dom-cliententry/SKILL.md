---
name: remix3-inline-edit-dom-cliententry
description: "Inline-edit a server-rendered table cell using a single Remix 3 clientEntry with DOM manipulation"
user-invocable: false
origin: auto-extracted
---

# Remix 3: Inline-Edit Server-Rendered Table Cells via DOM Manipulation

**Extracted:** 2026-06-15
**Context:** Adding an editable email column to a server-rendered admin table using one `clientEntry` component (not per-row).

## Problem

You have a server-rendered `<table>` in Remix 3 and want inline editing: click a cell → it becomes an `<input>` → save via fetch → grid refreshes.

A naive approach creates one `clientEntry` per row (`N` hydrations, `N` closured states). This causes `handle.update()` issues because each clientEntry re-renders independently, and the server-owned table DOM is hard to coordinate.

## Solution

Use a **single** `clientEntry` per page. Since the table is owned by the server component, the clientEntry cannot re-render individual cells via its render function. Instead, use **DOM manipulation** to replace cell content with an `<input>`.

### Architecture

```
Single clientEntry
  ├── Click delegation on <table> (not per-cell listeners)
  ├── DOM: replace <td>.textContent with <input>
  ├── fetch PUT /resource/:id with JSON + CSRF
  ├── On success: handle.frame.reload()
  └── On error: append <div> error to the cell
```

### Implementation Pattern

```tsx
import { clientEntry, css, type Handle } from 'remix/ui'

export const InlineEdit = clientEntry(
  import.meta.url + '#InlineEdit',
  function InlineEdit(handle: Handle) {
    let activeInput: HTMLInputElement | null = null
    let activeCell: HTMLTableCellElement | null = null
    let activeRowId: number | null = null
    let originalValue = ''
    let saving = false

    handle.signal.addEventListener('abort', () => {
      cleanup()
    })

    function cleanup() {
      activeInput = null
      activeCell = null
      activeRowId = null
      originalValue = ''
      saving = false
    }

    // ⚠️ MUST use named function — not anonymous arrow
    // The same reference is used for both addEventListener and removeEventListener
    function onCellClick(e: Event) {
      if (saving) return
      let cell = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-inline-edit]')
      if (!cell) return
      if (activeCell) { commitEdit(); return }  // save current, don't open new
      startEdit(cell)
    }

    return () => {
      if (typeof document !== 'undefined') {
        let table = document.querySelector<HTMLElement>('#my-table')
        if (!table) return <div mix={css({ display: 'none' })} />

        table.addEventListener('click', onCellClick)

        handle.signal.addEventListener('abort', () => {
          table.removeEventListener('click', onCellClick)  // same ref
        })
      }
      return <div mix={css({ display: 'none' })} />
    }

    function startEdit(cell: HTMLTableCellElement) {
      if (saving) return
      let row = cell.closest<HTMLTableRowElement>('[data-row-id]')
      if (!row) return

      activeRowId = Number(row.getAttribute('data-row-id'))
      originalValue = cell.textContent?.trim() ?? ''
      activeCell = cell

      let input = document.createElement('input')
      input.type = 'email'
      input.value = originalValue
      input.addEventListener('keydown', onInputKeydown)
      input.addEventListener('blur', onInputBlur)

      cell.textContent = ''
      cell.appendChild(input)
      activeInput = input
      input.focus()
      input.select()
    }

    function onInputKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
    }

    function onInputBlur() {
      if (!saving) commitEdit()
    }

    function commitEdit() {
      if (!activeInput || !activeCell || !activeRowId) return
      let newValue = activeInput.value.trim()
      if (!newValue || newValue === originalValue) { revertCell(); return }

      saving = true
      let csrfToken = readCsrfToken()
      let rowId = activeRowId

      fetch(`/resource/${rowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Csrf-Token': csrfToken,
        },
        body: JSON.stringify({ email: newValue }),
      })
        .then(async (res) => {
          if (res.ok) {
            cleanup()
            handle.frame.reload().catch(() => {})  // ⚠️ frame.reload() returns a Promise
          } else {
            let data = await res.json().catch(() => ({ error: 'Save failed' }))
            saving = false
            showError(data.error || 'Save failed')
          }
        })
        .catch(() => { saving = false; showError('Network error') })
    }

    function cancelEdit() { revertCell() }

    function revertCell() {
      if (activeCell && activeInput) {
        activeCell.textContent = originalValue
      }
      cleanup()
    }

    function showError(msg: string) {
      if (!activeCell || !activeInput) return
      let err = document.createElement('div')
      err.textContent = msg
      err.style.cssText = 'color:red;font-size:0.7rem;margin-top:2px;'
      activeCell.appendChild(err)
      activeInput.focus()
    }
  },
)
```

### Server-Side Wiring

The server-rendered table needs:

1. **`data-inline-edit`** on editable cells
2. **`data-row-id`** on each `<tr>`
3. **CSRF token** embedded (e.g., `<script id="grid-state" ...>` or `<meta name="csrf-token">`)
4. **`tabindex={0}`, `role="button"`, `aria-label`** on editable cells for keyboard access
5. **Controller** must accept `Content-Type: application/json` bodies for partial updates

```tsx
// Grid page (server component)
<td
  data-inline-edit="email"
  tabindex={0}
  role="button"
  aria-label={`Edit email: ${row.email}`}
>{row.email}</td>
```

```typescript
// Controller
if (contentType.includes('application/json')) {
  let body = await request.json()
  // validate + update + return JSON
  return context.json({ ok: true })
}
// else: existing form-data path unchanged
```

## Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Anonymous arrow in addEventListener | removeEventListener silently fails → memory leak | Store handler in named variable |
| Not guarding `saving` flag | Race condition: two saves fire simultaneously | `if (saving) return` at top of click handler |
| Not catching `handle.frame.reload()` | Unhandled promise rejection on network error | `.catch(() => {})` |
| InnerHTML instead of textContent | XSS vulnerability if cell contains user data | Always use `.textContent` |

## When to Use

- Adding inline editing to an existing server-rendered table
- Admin CRUD interfaces where one `clientEntry` should manage all rows
- Any pattern where a `clientEntry` needs to edit DOM it doesn't own (server-rendered)
