<!-- Context: project-intelligence/newapp/errors/prebuilt-component-ssr-bridge | Priority: high | Version: 1.0 | Updated: 2026-05-19 -->

# Error: Pre-built Remix UI Components Not Working in SSR Without clientEntry Bridge

**Symptom**: A pre-built `remix/ui/*` component (e.g., `Menu`, `Popover`, `Select`) renders its HTML structure correctly on the server page, but clicks/events do nothing when the page loads in the browser. No console errors, no hydration warnings — the component is visible but inert.

---

## Root Cause

The problem is an architectural mismatch between **SSR rendering** and **client-side module shipping**:

1. **SSR renders the component's HTML**: The server processes `layout.tsx` and outputs correct HTML (structure, classes, attributes).
2. **The component uses client-side mixins**: `Menu` uses `createMixin` with `on('click', handler)` — designed to execute in the browser.
3. **The module isn't shipped to the client**: `remix/ui/menu` is only imported in a server component. The build system doesn't include it in the client bundle because:
   - It's not referenced by `clientEntry`
   - It's not imported by `entry.tsx` or any file it statically imports
   - The resumable runtime can't re-evaluate mixins from unloaded modules
4. **`run()` never loads the module**: `loadModule` dynamically imports only what `clientEntry` declares. Without `clientEntry`, the module is never requested from the asset server.

### Why `Button` Works but `Menu` Doesn't

| Component | SSR Result | Why |
|-----------|-----------|-----|
| `<Button tone="primary">` | ✅ Fully interactive | Uses the Handle pattern — pure SSR, no client mixins needed |
| `<Menu>` | ❌ Inert on click | Uses `createMixin` with `on('click')` — needs client runtime |
| `<Popover>` | ❌ Inert | Uses `popover.surface()` + `on()` mixins — needs client runtime |
| `<Select>` | ❌ Inert | Compound component with popover + events — needs client runtime |

---

## The Established Pattern (What Works)

All interactive components in newapp use `clientEntry` to bridge server HTML with client behavior:
`ShowcaseDropdown`, `ThemeToggle`, `AdminActionButton`, `ConnectionIndicator`, `FormLoadingState`, `DelButton` — all in `app/assets/`.

`clientEntry` works because:
1. `import.meta.url + '#ExportName'` tells the build system to include it in the client bundle
2. `entry.tsx:8` dynamically imports it via `loadModule`
3. Inside `clientEntry`, `on('click')`, `document.addEventListener`, `ref()` all run in the browser

---

## Fix Options

### Option 1: Build a Custom `clientEntry` Wrapper (Recommended)

Wrap the behavior in a `clientEntry` module that uses `document.addEventListener` or `on()` mixins directly on server-rendered HTML elements:

```tsx
// app/assets/my-dropdown.tsx
import { clientEntry, type Handle } from 'remix/ui'

export const MyDropdown = clientEntry(
  import.meta.url + '#MyDropdown',
  function MyDropdownEntry(handle: Handle) {
    let initialized = false

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        document.addEventListener('click', (e) => {
          let btn = document.getElementById('my-dropdown-btn')
          let menu = document.getElementById('my-dropdown-menu')
          if (!btn || !menu) return

          // toggle logic...
        })
      }
      return null  // UI is server-rendered
    }
  },
)
```

Then render the `clientEntry` component in your server component:

```tsx
// app/ui/layout.tsx — Server renders the HTML structure
<button id="my-dropdown-btn" ...>Open</button>
<div id="my-dropdown-menu" ...>...</div>
<MyDropdown />  {/* Adds client behavior */}
```

### Option 2: Use Pre-built Components Inside a `clientEntry` Module

Import pre-built components inside a `clientEntry` module so their code ships to the client:

```tsx
import { clientEntry, type Handle } from 'remix/ui'
import { Menu } from 'remix/ui/menu'

export const InteractiveMenu = clientEntry(
  import.meta.url + '#InteractiveMenu',
  function InteractiveMenuEntry(handle: Handle) {
    return () => (<Menu trigger={<button>Open</button>}><MenuItem>...</MenuItem></Menu>)
  },
)
```

---

## Prevention Checklist

- [ ] Before using a pre-built `remix/ui/*` component, check whether it uses client-side mixins (`on()`, `ref()`, `popover.surface()`, etc.)
- [ ] If it uses mixins, it needs a `clientEntry` bridge to ship to the client
- [ ] SSR-safe components (Handle pattern only, no mixins) like `Button` can be used directly in server components
- [ ] All interactive components in the newapp codebase follow the `clientEntry` pattern — follow existing examples
- [ ] When a new `clientEntry` is added, ensure the file is accessible by the asset server (check `app/assets.ts` allow list)

---

## 📂 Codebase References

**Working clientEntry examples (canonical patterns)**:
- `app/assets/showcase-dropdown.tsx` — Custom dropdown with `document.addEventListener` (reverted from failed `remix/ui/menu` attempt)
- `app/assets/theme-toggle.tsx` — Theme toggle with event delegation
- `app/assets/admin-action-button.tsx` — Button with `on('click', ...)`
- `app/assets/client-del-button.tsx` — Delete confirmation with event handler

**Client runtime**:
- `app/assets/entry.tsx:7-15` — `loadModule` dynamically imports modules by URL
- `app/assets/entry.tsx` — `run()` scans for `clientEntry` hydration markers

**Asset server**:
- `app/assets.ts` — Allow list controls which files are accessible to the asset server

**Server-rendered usage**:
- `app/ui/layout.tsx:11` — `ShowcaseDropdown` imported from `clientEntry` module
- `app/ui/layout.tsx:66-90` — Server-rendered HTML for the dropdown trigger + menu

## Related

- [clientEntry hash fragment guide](../guides/client-entry-pattern.md) — Always use `import.meta.url + '#ExportName'`
- [clientEntry export mismatch](./client-entry-export-mismatch.md) — What happens when hash doesn't match export
- [Component adoption guide](../guides/component-adoption.md) — When to adopt pre-built `remix/ui/*` components
- [clientEntry side-effect patterns (remix3)](../../development/remix3/ui/guides/client-entry-side-effects.md) — General side-effect-only pattern
- [clientEntry + Frame hydration (my_app)](../../project-intelligence/my_app/errors/client-entry-hydration.md) — Similar issue in Frame context, lists `Menu`/`Select`/`Popover`/`Combobox`/`Listbox` as requiring clientEntry
- [Frame vs clientEntry (remix3)](../../development/remix3/ui/concepts/frame-vs-client-entry.md) — Decision matrix between data-loading and interaction boundaries
