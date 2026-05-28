<!-- Context: development/remix3/examples/editable-fields | Priority: high | Version: 1.2 | Updated: 2026-03-26 -->

# Editable Fields

Click-to-edit pattern using client components. Interactive inline editing without full page reload.

## Architecture
1. **Client Component** (`app/assets/*-edit.tsx`) - Interactive UI
2. **Fragment Handler** (`app/fragments/controller.tsx`) - SSR
3. **API Handler** - Handles mutations
4. **Toast Handler** - Notifications

## Routes
```typescript
fragments: route('fragments', { titleEdit: get('title-edit/:itemId') }),
api: route('api', { updateTitle: post('items/:itemId/title') }),
```

## Client Component Pattern
```typescript
import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

type TitleEditProps = {
  itemId: string | number
  title: string
}

export let TitleEdit = clientEntry('/assets/title-edit.js#TitleEdit', function TitleEdit(handle: Handle<TitleEditProps>) {
  let state = { editing: false, loading: false, value: '', originalValue: '' }
  return () => {
    let { itemId, title } = handle.props
    if (state.value !== title && !state.loading) { state.value = title; state.originalValue = title }
    if (state.loading) return <span class="badge">...</span>
    if (state.editing) return (<span>
      <input data-title-input defaultValue={state.value} />
      <button onClick={async () => {
        let newValue = document.querySelector('[data-title-input]')?.value ?? state.value
        let res = await fetch(routes.api.updateTitle.href({ itemId }), { method: 'POST', body: JSON.stringify({ title: newValue }) })
        if (res.ok) { state.editing = false; showToast('Title updated'); setTimeout(() => handle.frame.reload(), 500) }
      }}>Save</button>
      <button onClick={() => { state.editing = false; state.value = state.originalValue }}>Cancel</button>
    </span>)
    return <span onClick={() => { state.editing = true }}>{state.value}</span>
  }
})
```

## Key Points
- `e.stopPropagation()` on all buttons
- `originalValue` for Cancel reset
- `handle.update()` for local state, `handle.frame.reload()` after mutations

## ⚠️ Lists Pattern (Important)
**Per-row clientEntry causes infinite loops.** For tables/lists, use a single `clientEntry` for the entire grid:
```typescript
type AdminBooksGridProps = {
  books: Array<{ id: number; title: string }>
}

export let AdminBooksGrid = clientEntry(moduleUrl, (handle: Handle<AdminBooksGridProps>) => {
  let editingCell: { bookId: number; field: string } | null = null
  return () => {
    let { books } = handle.props
    return (<tbody>{books.map(book => (
      <tr><td>{editingCell?.bookId === book.id ? <Input/> : book.title}</td></tr>
    ))}</tbody>)
  }
})
```
**Key rules**: Single `clientEntry` for whole list; state keyed by item ID; no `handle.update()` in render; `handle.frame.reload()` after mutations.

## 📝 Role Edit Pattern (Select)
For enum/string fields, use `<select>` instead of text input - toggle display/edit with role-option badges and conditional rendering.

## 🚫 Fragment Routes Optional
- **Need fragment routes**: Components rendered via `renderFragment()` in separate SSR
- **No fragment routes**: Components used directly in page JSX like `<AdminGrid items={items} />`

## Reference
- Base styles: `examples/skeleton-loaders.md` for loading states
- Error patterns: `errors/client-entry-loops.md`
