<!-- Context: development/remix3/guides/client-interactivity-patterns | Priority: high | Version: 1.0 | Updated: 2026-05-03 -->

# Client Interactivity Patterns in Remix 3 SSR

**Core Idea**: Remix 3 offers three approaches to client-side JS. `clientEntry` + `on()` is the only fully reliable pattern for interactive components. Inline `<script>` tags serve limited document-level use-cases. HTML event handler attributes are **not valid** in Remix 3 TSX types.

---

## Pattern Comparison

| Pattern | Mechanism | TSX Valid | Use Case |
|---------|-----------|-----------|----------|
| **Inline `<script>`** | Raw JS in SSR HTML | Yes | Document-level delegation only (theme toggle, hamburger) |
| **HTML event attributes** | `onclick`, `onsubmit` | **No** — type error | Never use |
| **`clientEntry` + `on()`** | Component via asset server | Yes | All interactive UI (buttons, forms, SSE, clipboard) |

---

## Pattern 1: Inline `<script>` Tags

### Reliable for: Document-level event delegation

Inline scripts work **consistently** when they use `document.addEventListener` with `e.target.closest()` — this survives DOM replacements from Frames/clientEntry:

```html
<script>{`
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('#theme-toggle');
    if (!btn) return;
    // toggle logic
  });
`}</script>
```

### Unreliable for: Component-specific setup

Inline scripts may **not execute** consistently in Fragment/Frame rendering and streaming response paths. The SSR pipeline does not guarantee `<script>` tag emission across all rendering paths.

### When inline scripts are acceptable

| Scenario | Why it works |
|----------|-------------|
| **Document-level delegation** (`#hamburger-btn`, `#theme-toggle`) | `document.addEventListener` survives DOM swaps |
| **Flash-prevention IIFE** in `<head>` | Runs synchronously before first paint |
| **Loading indicators** via `getElementById()` | Simple display toggle on existing elements |

### When inline scripts are NOT acceptable

| Scenario | Correct approach |
|----------|-----------------|
| Button click with state | `clientEntry` + `on('click', handler)` |
| Form submission with fetch | `clientEntry` + `on('submit', handler)` |
| SSE / clipboard | `clientEntry` returning `null` (side-effect-only) |

---

## Pattern 2: HTML Event Handler Attributes (Invalid)

Remix 3's TypeScript types — `FormHTMLProps`, `TextareaHTMLProps`, etc. — **do not include** HTML event attributes:

```tsx
// ❌ TypeScript error
<form onsubmit="validate()">...</form>
<button onclick="confirm('Delete?')">Delete</button>

// ✅ Correct: mix + on()
<form mix={[on('submit', async (e, signal) => {
  e.preventDefault()
})]}>...</form>
```

---

## Pattern 3: `clientEntry` + `on()` (Recommended)

```typescript
import { clientEntry, css, on, type Handle } from 'remix/ui'
import { theme } from 'remix/ui/theme'

export const MyButton = clientEntry(
  '/assets/app/ui/path.tsx#MyButton',
  function MyButton(handle: Handle) {
    let count = 0
    return () => (
      <button
        mix={[
          css({ background: theme.colors.action.primary.background }),
          on('click', async (_event, signal) => {
            count++
            handle.update()
          }),
        ]}
      >
        Count: {count}
      </button>
    )
  },
)
```

### Asset Server Allow List

Every `clientEntry` file **must** be in the asset server's `allow` list (`app/actions/controller.tsx`):

```typescript
allow: [
  'app/assets/**',
  'app/ui/prompt-button.tsx',  // clientEntry file
  'app/ui/toast.tsx',          // clientEntry file
  'node_modules/**',
],
```

Missing entries cause silent 404 on hydration.

---

## Quick Reference

```typescript
// ✅ clientEntry for interactive components
export const Interactive = clientEntry(url, (handle) => () => (
  <button mix={[on('click', handler), css({ ... })]}>Click me</button>
))

// ✅ Inline script for document-level delegation only
<script>{`document.addEventListener('click', function(e) {
  if (!e.target.closest('#id')) return;
})`}</script>

// ❌ NEVER: HTML event handler attributes
<button onclick="..." />  {/* TS error */}

// ❌ NEVER: component-specific inline scripts
<script>{`document.getElementById('specific-btn').addEventListener(...)`}</script>
```

---

## 📂 Codebase References

- `my_app/app/ui/prompt-button.tsx` — clientEntry + `on('click', ...)` for clipboard
- `my_app/app/ui/toast.tsx` — clientEntry + `on('click', ...)` for dismiss
- `my_app/app/ui/layout.tsx` — Hamburger menu via inline script (acceptable)
- `my_app/app/ui/document.tsx` — Theme toggle via inline script (acceptable)
- `my_app/app/actions/controller.tsx` — Asset server allow list

## Related
- `guides/client-entry-side-effects.md` — Side-effect-only clientEntry
- `guides/events.md` — Event handling with signal-based interruption
