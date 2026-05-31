<!-- Context: project-intelligence/newapp/guides/inline-rename-pattern | Priority: high | Version: 2.0 | Updated: 2026-05-23 -->

# Guide: Inline Rename with Textarea

**Purpose**: Edit appointment titles inline — double-click opens a `<textarea rows={2}>` with multiline support; `Shift+Enter` or Save button commits (PUT), `Escape` or Cancel button or blur cancels (discards without PUT).

---

## Flow

### 1. `startEdit()` → sets `editingId`, triggers re-render

```tsx
function startEdit(appt: { id: number; title: string }) {
  if (editingId !== null || activeGesture) return
  editingId = appt.id
  handle.update()
  requestAnimationFrame(() => {               // focus after DOM reconcile (prevents layout thrash)
    let input = renameInputs.get(appt.id)
    if (input) { input.value = appt.title; input.focus(); input.select() }
  })
}
```

### 2. Title Span Conditionally Rendered + Textarea with Save/Cancel Buttons

```tsx
{/* Title span hidden while editing — conditionally rendered instead of CSS display:none */}
{!isEditing ? (
  <span mix={[blockTitleStyle, isHovered ? expandedTitleStyle : undefined]}>
    {appt.title}
  </span>
) : null}

<textarea
  aria-label="Appointment title"
  rows={2}
  defaultValue={appt.title}
  mix={[
    inputStyle,
    isEditing ? undefined : hiddenStyle,
    ref((el) => {
      if (el) {
        renameInputs.set(appt.id, el)
      } else {
        renameInputs.delete(appt.id)
      }
    }),
    on('keydown', (e: any) => {
      if (e.key === 'Escape') { cancelEdit(); return }
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          e.preventDefault()
          commitEdit(appt, csrfToken)  // Shift+Enter = commit
        }
        return
      }
    }),
    on('blur', () => cancelEdit()),   // blur cancels (discards without PUT)
  ]}
/>

{/* Save / Cancel buttons — pointerdown prevents blur race */}
{isEditing ? (
  <div mix={draftButtonsStyle}>
    <button
      type="button"
      aria-label="Save appointment"
      mix={[draftSaveButtonStyle, on('pointerdown', (e: any) => { e.preventDefault(); commitEdit(appt, csrfToken) })]}
    >
      Save
    </button>
    <button
      type="button"
      aria-label="Cancel appointment"
      mix={[draftCancelButtonStyle, on('pointerdown', (e: any) => { e.preventDefault(); cancelEdit() })]}
    >
      Cancel
    </button>
  </div>
) : null}

{/* Resize handles — hidden during editing */}
{!isDragging && !isEditing ? (
  ...
) : null}
```

### 3. `commitEdit()` — PUT if title changed

```tsx
function commitEdit(
  appt: { id: number; title: string },
  csrfToken: string,
) {
  if (editingId !== appt.id) return

  let newTitle = getEditValue(appt.id)
  if (!newTitle || newTitle === appt.title) {  // no-op if unchanged
    editingId = null
    handle.update()
    return
  }

  let id = appt.id
  editingId = null
  handle.update()

  fetch(`/appointment/${id}`, {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Csrf-Token': csrfToken,
    },
    body: JSON.stringify({ title: newTitle }),
  }).then((r) => { if (r.ok) window.location.reload() }).catch(() => {})
}
```

---

## Key Behaviors

| Aspect | Behavior | Why |
|--------|----------|-----|
| Title span | Conditionally rendered (`{!isEditing ? <span/> : null}`) instead of CSS `display: none` | Prevents text overlap; avoids hidden DOM during edit |
| `defaultValue` | Uncontrolled — reads value via `ref()` map | Avoids controlled component sync issues |
| `Enter` | Inserts newline (native textarea) | Supports multiline titles |
| `Shift+Enter` | Commits and saves (PUT) | Explicit save gesture |
| Save button | `pointerdown` calls `commitEdit()` | Fires before blur, avoiding cancel-on-blur race |
| Cancel button | `pointerdown` calls `cancelEdit()` | Same pointerdown-before-blur strategy |
| `Escape` | Cancels, reverts to original title | Abandon without saving |
| `blur` | Cancels (discards without PUT) | Normal focus-loss = cancel, was previously auto-save |
| `rows={2}` | 2 rows visible; `overflow-y: auto` handles overflow | Compact by default, scrolls when needed |
| Block min-height | 84px while editing (via `editingBlockStyle` column layout) | Prevents textarea clipping in short blocks |
| Resize handles | Hidden during editing (`!isEditing` guard) | Prevent interference with textarea |

---

## CSS Summary (`inputStyle`)

The textarea inherits font from the block and applies:
- **`resize: none`** — inside positioned block; resize would break layout
- **`white-space: pre-wrap`** — preserves `Enter` line breaks, wraps long lines
- **`overflow-y: auto`** — scrolls within block when content exceeds 2 rows
- **`minHeight: 32px`** — enough for one line of text
- **`wordBreak: break-word`** — long unbroken strings wrap gracefully

Full CSS at `app/ui/appointment-grid.tsx` lines 1234–1251.

---

## RenameInputs Map

```tsx
let renameInputs = new Map<number, HTMLTextAreaElement>()  // was HTMLInputElement
```

Per-block textarea refs (vs single `draftInput` ref for new-appointment draft). The `ref()` mixin registers on mount, unregisters on unmount.

---

## Timing Dependency

`startEdit()` and `startDraft()` both use `requestAnimationFrame` (replacing the old `setTimeout(fn, 50)`) to focus the input after `handle.update()`. `rAF` is more reliable — fires after layout settle but before paint, avoiding the brittle timeout race. See [Known Issues](../lookup/known-issues.md).

---

## 📂 Codebase References

**Implementation**:
- `app/ui/appointment-grid.tsx` lines 75 — `renameInputs` type (`Map<number, HTMLTextAreaElement>`)
- `app/ui/appointment-grid.tsx` lines 453–494 — `startEdit()`, `cancelEdit()`, `getEditValue()`, `commitEdit()`
- `app/ui/appointment-grid.tsx` lines 234–288 — Title span conditional render, textarea with keydown/blur handlers, Save/Cancel buttons
- `app/ui/appointment-grid.tsx` lines 1197–1232 — `blockTitleStyle`, `expandedTitleStyle`, `editingBlockStyle`, `hiddenStyle` CSS
- `app/ui/appointment-grid.tsx` lines 1234–1251 — `inputStyle` CSS
- `app/ui/appointment-grid.tsx` lines 1269–1295 — `draftButtonsStyle`, `draftSaveButtonStyle`, `draftCancelButtonStyle` CSS
- `app/ui/appointment-grid.tsx` line 410 — `startDraft()` requestAnimationFrame focus pattern

**Related**:
- [Manual Double-click Detection](../concepts/manual-doubleclick-detection.md) — How edits are triggered
- [× Button Pointerdown Conflict](../errors/delete-button-pointerdown-conflict.md) — Why native dblclick is unavailable
- [Appointment Calendar Architecture](../concepts/appointment-calendar.md) — Full feature context
- [Appointment CRUD Guide](./appointment-crud.md) — Server-side PUT action
- [Known Issues — Input Focus Timing](../lookup/known-issues.md)
