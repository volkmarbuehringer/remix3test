<!-- Context: development/remix3/guides | Priority: high | Version: 1.0 | Updated: 2026-04-26 -->

# Full-Page clientEntry Routes

**Purpose**: Building SPA-like routes using `clientEntry()` with `Document` wrapper. Entire route handled client-side.

## Key Points

- **Document wrapper**: Provides HTML shell with `<script>` tag for entry hydration
- **Closure state**: Plain JS variables, updated via `handle.update()`
- **Event handlers**: `on('click', handler)` for interactions
- **Styling**: `css()` mixins for inline styles

## Implementation

### 1. Client Component (`app/assets/checker-client.tsx`)

```tsx
import { clientEntry, type Handle, on, css } from 'remix/ui'

type ListItem = { id: string; label: string }

export const Checker = clientEntry(import.meta.url, function Checker(handle: Handle) {
  let items: ListItem[] = []
  let count = 0

  let increment = () => {
    count++
    handle.update()  // Trigger re-render
  }

  return () => (
    <div>
      <p>Count: {count}</p>
      <button mix={[on('click', increment)]}>Increment</button>
      {items.map(item => <div key={item.id}>{item.label}</div>)}
    </div>
  )
})
```

### 2. Controller (`app/controllers/checker/controller.tsx`)

```tsx
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

### 3. Route Definition (`app/routes.ts`)

```tsx
export const routes = { checker: get('/checker', () => checker.handler()) }
```

## Document Wrapper

```tsx
// app/ui/document.tsx
import { assetServer } from '../utils/assets.ts'

export function Document({ title, children }) {
  return () => (
    <html>
      <head><title>{title}</title></head>
      <body>
        {children}
        <script src={assetServer.getHref('checker/app/assets/checker-client.tsx')} />
      </body>
    </html>
  )
}
```

## State & Events

| Aspect | Pattern | React Equivalent |
|--------|---------|-------------------|
| State | `let count = 0` | `useState(0)` |
| Update | `count++` + `handle.update()` | Auto re-render |
| Events | `on('click', handler)` | `onClick` |

### Event Examples

```tsx
// Click
<button mix={on('click', () => { count++ })}>

// Input
<input value={val} mix={on('input', (e) => {
  val = e.target.value
  handle.update()
})} />

// Submit
<form mix={on('submit', (e) => { e.preventDefault() })}>
```

## Styling

```tsx
const buttonStyle = css({ padding: '0.5rem', backgroundColor: 'blue' })

<button mix={[on('click', handler), buttonStyle]}>Click</button>
```

## When to Use

| Pattern | Use Case |
|---------|----------|
| **Full-page clientEntry** | SPA-like behavior, complex interactions |
| **Frame + fragment** | Small interactive islands in server pages |
| **Pure server** | Static content, SEO-critical pages |

## Codebase References

**Implementation**:
- `bookstore/app/assets/checker-client.tsx` - Full checker component
- `bookstore/app/controllers/checker/controller.tsx` - Route controller
- `bookstore/app/ui/document.tsx` - Document wrapper

**Related**:
- `concepts/client-component-anatomy.md` - Two-phase lifecycle
- `guides/client-state-management.md` - State patterns
- `guides/client-side-form-handling.md` - Form submission
- `guides/client-side-components.md` - Frame-based approach

## Anti-Patterns

- ❌ `const` for state (won't update)
- ❌ Missing `handle.update()` (UI won't refresh)
- ❌ React hooks (not supported)