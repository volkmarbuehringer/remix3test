<!-- Context: development/remix3/guides/inline-editing-patterns | Priority: medium | Version: 1.0 | Updated: 2026-05-07 -->

# Inline Cell Editing Patterns

**Purpose**: Double-click to edit table cells inline with Enter/blur to save, Escape to revert. Works with manual DOM swaps and event delegation.

---

## 1. Interaction Model

| Action | Behavior |
|--------|----------|
| **Double-click** | Cell content replaced with input/select editor |
| **Enter** | Finalize edit, save via POST, flash green on success |
| **Blur** (click away) | Same as Enter — finalize and save |
| **Escape** | Revert immediately — restore original text content |
| **Tab** (future) | Move to next editable cell (not yet implemented in pattern) |

For `<select>` editors (role, status), the change event triggers blur to finalize immediately.

## 2. HTML Structure

Cells are marked with `data-*` attributes for delegation:

```html
<!-- Text field -->
<td data-editable data-row-id="42" data-field="name" tabindex="0">
  Alice
</td>

<!-- Select field (role/status shown with color coding) -->
<td data-editable data-row-id="42" data-field="role" tabindex="0"
    style="color: #6366f1; font-weight: 600;">
  Admin
</td>

<!-- Date field -->
<td data-editable data-row-id="42" data-field="registered" tabindex="0">
  2025-01-15
</td>
```

Attributes:
- `[data-editable]` — Marks cell as editable
- `[data-row-id]` — Database row identifier
- `[data-field]` — Column/field name
- `tabindex="0"` — Keyboard focusable (Enter also triggers edit)

## 3. Client Entry Pattern

All inline editing logic lives in a single `clientEntry` component using `handle.queueTask()` for setup and `{ signal: handle.signal }` for cleanup:

```typescript
export const GridClient = clientEntry(
  import.meta.url,
  function GridClient(handle: Handle) {
    return () => {
      handle.queueTask(() => {
        // Keyboard activation: Enter key starts editing on focused cell
        document.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return
          let cell = (e.target as HTMLElement).closest('[data-editable]')
          if (!cell) return
          if (cell.querySelector('input, select')) return  // already editing
          cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        }, { signal: handle.signal })

        // Double-click to start editing
        document.addEventListener('dblclick', (e) => {
          let cell = (e.target as HTMLElement).closest('[data-editable]')
          if (!cell) return
          if (cell.querySelector('input, select')) return  // guard against re-edit

          let rowId = cell.getAttribute('data-row-id')
          let field = cell.getAttribute('data-field')
          if (!rowId || !field) return

          startEditing(cell, Number(rowId), field, handle)
        }, { signal: handle.signal })
      })

      return null
    }
  },
)
```

## 4. Editor Creation

Create a text input for string fields, a `<select>` for enum fields:

```typescript
const DROPDOWN_OPTIONS: Record<string, string[]> = {
  role: ['Admin', 'Editor', 'Viewer'],
  status: ['Active', 'Inactive'],
}

const EDITOR_STYLES =
  'width:100%;height:100%;padding:2px 6px;border:2px solid #6366f1;' +
  'border-radius:3px;font-size:0.8125rem;outline:none;' +
  'background:#fff;color:#0f172a;box-sizing:border-box;'

function createEditor(field: string, currentValue: string) {
  let options = DROPDOWN_OPTIONS[field]
  if (options) {
    let select = document.createElement('select')
    select.style.cssText = EDITOR_STYLES + 'cursor:pointer;'
    for (let opt of options) {
      let optionEl = document.createElement('option')
      optionEl.value = opt
      optionEl.textContent = opt
      if (opt === currentValue) optionEl.selected = true
      select.appendChild(optionEl)
    }
    return { element: select, getValue: () => select.value }
  }

  let input = document.createElement('input')
  input.type = 'text'
  input.value = currentValue
  input.style.cssText = EDITOR_STYLES
  return { element: input, getValue: () => input.value }
}
```

## 5. Start, Finalize, and Revert

```typescript
function startEditing(
  cell: HTMLElement,
  rowId: number,
  field: string,
  handle: Handle,
): void {
  let currentValue = (cell.textContent || '').trim()
  let { element, getValue } = createEditor(field, currentValue)

  cell.innerHTML = ''
  cell.appendChild(element)
  element.focus()
  if (element instanceof HTMLInputElement) element.select()

  // Finalize: persists the value to the server
  let finalize = () => {
    if (!cell.contains(element)) return  // already reverted via Escape
    let newValue = getValue()
    if (newValue !== currentValue) {
      cell.style.opacity = '0.5'
      saveCell(rowId, field, newValue).then((ok) => {
        if (ok) {
          cell.textContent = newValue
          cell.style.opacity = '1'
          cell.focus()
          flashSuccess(cell)
        } else {
          cell.textContent = currentValue  // restore on error
          cell.style.opacity = '1'
        }
      })
    } else {
      cell.textContent = currentValue  // no change
    }
  }

  // Enter → blur → finalize
  element.addEventListener('keydown', (ke: KeyboardEvent) => {
    if (ke.key === 'Enter') {
      ke.preventDefault()
      element.blur()
    }
    if (ke.key === 'Escape') {
      ke.preventDefault()
      cell.textContent = currentValue  // revert immediately
    }
  }, { signal: handle.signal })

  // Blur → finalize
  element.addEventListener('blur', finalize, { signal: handle.signal })

  // Select fields: finalize on change
  if (element instanceof HTMLSelectElement) {
    element.addEventListener('change', () => element.blur(), { signal: handle.signal })
  }
}
```

## 6. Save Cell (POST to Server)

```typescript
async function saveCell(
  rowId: number,
  field: string,
  value: string,
): Promise<boolean> {
  try {
    let body = new URLSearchParams({ rowId: String(rowId), field, value })
    let res = await fetch('/client/save', {
      method: 'POST',
      body,
      credentials: 'same-origin',
    })
    return res.ok
  } catch (e) {
    console.error('Save failed:', e)
    return false
  }
}
```

## 7. Success Flash

```typescript
function flashSuccess(cell: HTMLElement): void {
  let origBg = cell.style.backgroundColor
  cell.style.transition = 'background-color 120ms ease'
  cell.style.backgroundColor = '#d4edda'  // green flash
  setTimeout(() => { cell.style.backgroundColor = origBg }, 600)
  setTimeout(() => { cell.style.transition = '' }, 800)
}
```

## 8. Server-Side Handler (POST)

```typescript
async save({ get }) {
  let db = getContext().db
  let formData = get(FormData)
  let rowId = formData.get('rowId')
  let field = formData.get('field')
  let value = formData.get('value')

  // Validate rowId, field exists
  // Validate field is an allowed column name
  // Validate value meets constraints

  await db.update(clients, rowNum, { [field]: value })
  return Response.json({ ok: true })
}
```

## 9. State Diagram

```
                      double-click
  [Normal Cell] ──────────────────────► [Editing with editor]
       ▲                                    │          │
       │                      Enter/blur    │          │ Escape
       │                        + save      │          │
       │                          ↓         │          ▼
       │                    [Saving...]  ◄──┘    [Normal Cell]
       │                    (opacity: 0.5)       (textContent restored)
       │                          │
       │                 success  │  error
       │                          ↓
       │                    [Flash Green]
       │                    (bg: #d4edda)
       │                          │
       └──── timeout ─────────────┘
```

## Codebase References

- `my_app/app/assets/grid-client.ts` — Complete inline editing implementation: createEditor, startEditing, saveCell, flashSuccess
- `my_app/app/actions/client/grid-page.tsx` — Server-rendered cells with `[data-editable]`, `[data-row-id]`, `[data-field]` attributes
- `my_app/app/actions/client/controller.tsx` — POST `/client/save` endpoint

## Related

- `guides/manual-fetch-patterns.md` — Event delegation pattern that enables inline editing across DOM swaps
- `guides/server-embedded-json.md` — Server-embedded field options for dropdown editors
- `ui/guides/client-entry-side-effects.md` — queueTask + signal lifecycle for client entries
- `guides/form-patterns.md` — Form patterns for comparison (side panel edit form vs inline)
