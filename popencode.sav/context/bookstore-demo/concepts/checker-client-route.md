<!-- Context: bookstore-demo/concepts | Priority: high | Version: 1.1 | Updated: 2026-04-26 -->

# Client-Side Checker Route Pattern

**Core Idea**: Interactive client-side route using `clientEntry()` for SPA-like behavior without React. The checker route demonstrates a counter and list management UI entirely in the browser, with state managed via closure variables and event handlers.

---

## Key Points

- **`clientEntry()` pattern**: Exports component for client-side hydration, no React required
- **State management**: Plain JS variables (`let`) in closure, updated via `handle.update()`
- **Route integration**: `Document` wrapper provides entry script loading
- **Event handling**: `on()` for click/input events, `css()` for inline styles
- **Asset serving**: `assetServer` serves client-side code via HTTP
- **Save action**: POST to server route with FormData, pending state, toast feedback
- **AbortSignal**: Pass to fetch for cancelable requests

---

## Quick Example

```tsx
// app/assets/checker-client.tsx
import { clientEntry, type Handle, on, css } from 'remix/ui'

type ListItem = { id: string; label: string }

export const Checker = clientEntry(import.meta.url, function Checker(handle: Handle) {
  let items: ListItem[] = []
  let count = 0

  // Event handler pattern
  let increment = () => {
    count++
    handle.update()  // Trigger re-render
  }

  return () => (
    <div>
      <p>Count: {count}</p>
      <button mix={[on('click', increment)]}>Increment</button>
      {/* List with inline styles */}
      {items.map(item => <div key={item.id}>{item.label}</div>)}
    </div>
  )
})
```

```tsx
// app/controllers/checker/controller.tsx
import { Checker } from '../../assets/checker-client.tsx'
import { Document } from '../../ui/document.tsx'

export const checker = {
  handler() {
    return render(
      <Document title="Checker">
        <Checker />
      </Document>
    )
  },
}
```

**Route Definition** (`app/routes.ts`):
```typescript
export const routes = { checker: get('/checker') }
```

---

## How It Works

### 1. clientEntry Component

- `clientEntry(url, component)` exports a named component from a `.tsx` file
- The second argument is a setup function returning a render function
- Uses plain JS variables for state (not React hooks)
- `handle.update()` triggers re-render after state changes

### 2. Event Handling

- `on('click', handler)` attaches event handlers
- `on('input', handler)` handles input changes
- Handlers update closure variables and call `handle.update()`

### 3. Document Wrapper

- `<Document>` provides HTML shell with `<script>` for entry
- Its render function inlines the client entry script
- The script hydrates the rendered HTML content

### 4. Asset Server

- `assetServer.getHref(entryId)` resolves the client script URL
- Entry ID format: module URL + `#` + export name
- Asset server serves built client code via HTTP

### 4. Save Action Pattern

- **POST route**: Add `save: post('/save')` to nested route definition
- **Controller action**: `actions.save()` receives `FormData` via dependency injection
- **Database create**: Parse JSON from form, insert into table with timestamps
- **Client handling**: Use `AbortSignal` for cancelable fetch, handle response

```tsx
// Client-side save
let saveList = async (signal: AbortSignal) => {
  saving = true
  handle.update()

  let formData = new FormData()
  formData.set('items', JSON.stringify(items))

  let response = await fetch(routes.checker.save.href(), {
    method: 'POST',
    body: formData,
    signal,
  })

  if (!signal.aborted && response.ok) {
    saving = false
    showSavedToast = true
    handle.update()
    // Auto-hide toast after 2s
    setTimeout(() => {
      showSavedToast = false
      handle.update()
    }, 2000)
  }
}
```

```tsx
// Controller save action
async save({ get }) {
  let db = get(Database)
  let formData = get(FormData)
  let itemsStr = formData.get('items')

  let items = []
  if (typeof itemsStr === 'string' && itemsStr.trim()) {
    items = JSON.parse(itemsStr)
  }

  await db.create(lists, {
    list: JSON.stringify(items),
    created_at: BigInt(Date.now()),
    updated_at: BigInt(Date.now()),
  })

  return Response.json({ success: true, count: items.length })
}
```

---

## Codebase References

**Implementation**:
- `bookstore/app/assets/checker-client.tsx` - Full checker component with save
- `bookstore/app/controllers/checker/controller.tsx` - Route controller with save action
- `bookstore/app/routes.ts` - Route definition with nested save (lines 93-96)
- `bookstore/app/router.ts` - Router mapping
- `bookstore/app/utils/assets.ts` - Asset server configuration
- `bookstore/app/data/schema.ts` - Lists table schema

---

## Related Patterns

- `concepts/chat-log-pattern.md` - Similar clientEntry with fetch API
- `../development/remix3/guides/client-side-form-handling.md` - Form handling pattern
- `../development/remix3/concepts/client-component-anatomy.md` - Two-phase lifecycle
- `../development/remix3/examples/counter-pattern.md` - Simple counter example