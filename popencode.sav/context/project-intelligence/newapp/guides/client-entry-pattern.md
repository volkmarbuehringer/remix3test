<!-- Context: project-intelligence/newapp/guides/client-entry-pattern | Priority: high | Version: 2.0 | Updated: 2026-05-21 -->

# Guide: clientEntry URL Hash Fragment Pattern

**Core Idea**: Always use `import.meta.url + '#ExportName'` as the first argument to `clientEntry()`, where `ExportName` matches the **exported variable name**. This ensures correct module resolution regardless of the handler function name.

---

## The Problem

`clientEntry()` accepts a module URL and a handler function. At runtime, `entry.ts` calls `mod[exportName]` to resolve the export. Without a hash fragment, the system infers the export name from the handler **function name**:

```tsx
// ❌ Fragile — export name guessed from function name
export const ThemeToggle = clientEntry(
  import.meta.url,
  function ThemeToggleEntry(handle) {  // function name ≠ export name → WRONG
    // ...
  },
)
```

When function name (`ThemeToggleEntry`) differs from export name (`ThemeToggle`), the runtime looks for `mod.ThemeToggleEntry` which doesn't exist → component fails to hydrate silently.

---

## The Fix: Hash Fragment

Append `#ExportName` to the URL to explicitly specify which export to resolve:

```tsx
// ✅ Robust — explicit export name via hash fragment
export const ThemeToggle = clientEntry(
  import.meta.url + '#ThemeToggle',  // ← hash matches export name
  function ThemeToggleEntry(handle) {
    // ...
  },
)
```

The `entry.ts` `loadModule` splits the URL on `#` and uses the fragment as the export name for `mod[exportName]`.

---

## When Names Happen to Match

If the handler function name coincidentally matches the export name, omitting the hash works by accident:

```tsx
// ⚠️ Works by accident — function name = export name
export const ListsClient = clientEntry(
  import.meta.url,           // no hash, but function is named ListsClient
  function ListsClient(handle) {
    // ...
  },
)
```

**Still use the hash.** The pattern is the same regardless of whether names match. This:
- Prevents breakage if the function is renamed later
- Makes the intent explicit for all readers
- Follows the standard rather than relying on coincidence

---

## The Standard Pattern

```tsx
import { clientEntry, type Handle } from 'remix/ui'

export const ThemeToggle = clientEntry(
  import.meta.url + '#ThemeToggle',
  function ThemeToggleEntry(handle: Handle) {
    // initialization...
    return () => {
      // render...
      return null  // server-rendered UI; clientEntry adds behavior only
    }
  },
)
```

### Client entries in `newapp`

| Export | File | Hash Used? | Function Name |
|--------|------|------------|---------------|
| `ThemeToggle` | `app/assets/theme-toggle.tsx` | ✅ `'#ThemeToggle'` | `ThemeToggleEntry` |
| `ListsClient` | `app/assets/lists-client.tsx` | ❌ (omitted) | `ListsClient` (matches) |
| `PromptButton` | `app/assets/prompt-button.tsx` | ❌ (omitted) | `PromptButton` (matches) |

> **Rule**: Always add the hash. Even when names match, use `import.meta.url + '#ExportName'` for consistency.

---

## ⚠️ Mandatory: Zero-Argument RenderFn + `Handle<PropsType>` Generic

**All `clientEntry` component render functions MUST be zero-argument** and use `Handle<PropsType>` generic. The upstream runtime calls render functions with no arguments — props are accessed via `handle.props` closure.

### ✅ Correct Pattern

```tsx
import { clientEntry, type Handle, type SerializableProps } from 'remix/ui'

interface MyButtonProps extends SerializableProps {
  label: string
  onClickAction: string
}

export const MyButton = clientEntry(
  import.meta.url + '#MyButton',
  function MyButton(handle: Handle<MyButtonProps>) {
    // ─── setup phase (state init, event binding) ───
    let pending = false

    // Render function MUST be zero-arg
    return () => {
      // ─── render phase (access via handle.props) ───
      let { label } = handle.props

      return <button type="button">{label}</button>
    }
  },
)
```

### ❌ Wrong: Props via Render Function Parameter

```tsx
// ❌ Will break at runtime — RenderFn receives no arguments
export const MyButton = clientEntry(
  import.meta.url + '#MyButton',
  function MyButton(handle: Handle) {
    return (props: MyButtonProps) => {  // ← props will be undefined!
      // ...render with props...
    }
  },
)
```

### Why This Is Required

| Aspect | Requirement | Reason |
|--------|-------------|--------|
| **RenderFn** | Zero-argument `() => RemixNode` | Upstream calls render with no args; props parameter receives `undefined` |
| **Handle generic** | `Handle<PropsType>` | Provides type-safe `handle.props` access to serializable JSX attributes |
| **Props base** | `extends SerializableProps` | Ensures all props are JSON-serializable for client hydration |

### Components Updated in Migration (4 files)

| File | Pattern Applied |
|------|----------------|
| `app/assets/admin-action-button.tsx` | `Handle<AdminActionButtonProps>`, zero-arg render, `handle.props` |
| `app/assets/chatlog-row-detail.tsx` | `Handle<ChatlogRowDetailProps>`, zero-arg render, `handle.props` |
| `app/assets/client-del-button.tsx` | `Handle<DelButtonProps>`, zero-arg render, `handle.props` |
| `app/assets/nutzer-del-button.tsx` | `Handle<NutzerDelButtonProps>`, zero-arg render, `handle.props` |

### Related

- [Handle pattern migration](../guides/handle-pattern-migration.md) — Full migration guide from factory to Handle pattern
- [clientEntry Props Index Signature](../../development/remix3/errors/client-entry-props.md) — Props must be `SerializableProps`

---

## Asset Server Allow List

All client entry files must be accessible by the asset server. The `createAssetServer` config in `app/assets.ts` must include the file's directory in `allow`:

```ts
allow: ['app/assets/**', 'app/ui/**', 'node_modules/**', ...]
```

- `app/assets/**` covers all client entry files
- `app/ui/**` covers mixins and primitives imported by client entries

---

## ⚠️ Common Mistakes

- **Omitting hash when names differ** → Silent hydration failure (component renders but doesn't initialize)
- **Hash matches function name, not export name** → Same failure — export must match the `const` name
- **File not in allow list** → 404 on module fetch, no console error

---

## 📂 Codebase References

- **theme-toggle (canonical)**: `app/assets/theme-toggle.tsx` — Correct hash pattern
- **lists-client (needs fix)**: `app/assets/lists-client.tsx` — No hash (works by accident)
- **prompt-button (needs fix)**: `app/assets/prompt-button.tsx` — No hash (works by accident)
- **Entry point**: `app/assets/entry.ts` — `loadModule` resolves `mod[exportName]` from hash
- **Asset server**: `app/assets.ts` — Allow list config

## Related

- [App architecture](../concepts/architecture.md) — File ownership and key decisions
- [clientEntry export mismatch error](../errors/client-entry-export-mismatch.md) — What happens when names differ
- [Asset server config example](../../development/remix3/examples/asset-server-config.md) — General config patterns
- [Frame vs clientEntry (remix3)](../../development/remix3/ui/concepts/frame-vs-client-entry.md) — Decision matrix
