<!-- Context: project-intelligence/newapp/errors/client-entry-export-mismatch | Priority: high | Version: 1.0 | Updated: 2026-05-11 -->

# Error: clientEntry Handler Name ≠ Export Name

**Symptom**: A `clientEntry` component renders on the page but its client-side behavior never activates. No events fire, no state updates work. No console error is shown.

---

## Detection

The component appears in the DOM (server-rendered HTML is visible) but it has no client behavior:
- Theme toggle button does nothing on click
- ListsClient shows empty state but no interaction works
- PromptButton doesn't copy to clipboard

There is **no JavaScript console error** — the module loads but the wrong export is resolved.

---

## Root Cause

When `clientEntry()` is called without a hash fragment:

```tsx
export const ThemeToggle = clientEntry(
  import.meta.url,               // ← no hash
  function ThemeToggleEntry(handle) {
    // ...
  },
)
```

The `entry.ts` runtime resolves the export by looking for `entry.mod.ThemeToggleEntry` (the function name). But the actual export is `ThemeToggle` → resolution returns `undefined` → the handler never runs.

This happens because:
1. `clientEntry` infers the export name from the **handler function name** (`ThemeToggleEntry`)
2. `entry.ts` runs `mod[exportName]` where `exportName` is `ThemeToggleEntry`
3. The module exports `ThemeToggle`, not `ThemeToggleEntry` → `mod['ThemeToggleEntry']` is `undefined`

---

## Fix

Always append `#ExportName` to `import.meta.url`:

```tsx
export const ThemeToggle = clientEntry(
  import.meta.url + '#ThemeToggle',  // ← hash matches export const name
  function ThemeToggleEntry(handle) {
    // ...
  },
)
```

The `entry.ts` `loadModule` splits on `#` and uses `ThemeToggle` as the export name → `mod['ThemeToggle']` resolves correctly.

---

## Prevention Checklist

- [ ] Every `clientEntry()` call uses `import.meta.url + '#ExportName'`
- [ ] The hash value matches the `export const` name, NOT the handler function name
- [ ] Even when names match (e.g., both are `ListsClient`), still include the hash for consistency

## Affected Files (newapp)

| File | Current | Needs Fix? |
|------|---------|------------|
| `app/assets/theme-toggle.tsx` | ✅ `import.meta.url + '#ThemeToggle'` | No |
| `app/assets/lists-client.tsx` | ❌ `import.meta.url` (no hash) | Yes — function name matches by accident |
| `app/assets/prompt-button.tsx` | ❌ `import.meta.url` (no hash) | Yes — function name matches by accident |

---

## 📂 Codebase References

- **Broken pattern**: `app/assets/lists-client.tsx` — No hash (works by coincidence)
- **Broken pattern**: `app/assets/prompt-button.tsx` — No hash (works by coincidence)
- **Fixed pattern**: `app/assets/theme-toggle.tsx` — Correct hash usage
- **Runtime resolution**: `app/assets/entry.ts` — `loadModule` calls `mod[exportName]`

## Related

- [clientEntry hash fragment guide](../guides/client-entry-pattern.md) — The standard pattern
- [clientEntry issues (remix3)](../../development/remix3/errors/client-entry-issues.md) — General clientEntry problems
- [clientEntry props (remix3)](../../development/remix3/errors/client-entry-props.md) — Props serialization issues
