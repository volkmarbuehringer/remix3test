<!-- Context: development/remix3/ui/errors/context-api-ssr-limitation | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# Error: context API SSR Limitation

**Issue**: `handle.context.set()` and `handle.context.get()` only work inside `clientEntry` components (browser-side). Server-rendered components cannot use them.

## What Goes Wrong

Context providers rendered in SSR trees are **inert** for context purposes:

```tsx
// ✅ WORKS — inside clientEntry (browser-side)
export let ThemeProvider = clientEntry('/theme.js#ThemeProvider', function(handle: Handle<{ children: any }>) {
  handle.context.set({ theme: 'dark' })  // ✅ context is provided
  return () => handle.props.children
})

// ❌ DOES NOT WORK — server-rendered component (handle.context unavailable)
function ThemeProvider(handle: Handle<{ children: RemixNode }>) {
  // No handle.context available during SSR — cannot call context.set()
  return () => <div>{handle.props.children}</div>
}
```

## Root Cause

The `handle.context` API is provided by the **`clientEntry`** wrapper, which creates a context tree during client-side hydration. Server-rendered components receive a `handle` parameter but `handle.context` is only active during client-side rendering. Context calls in SSR are no-ops.

The `component()` factory function that would provide context to non-clientEntry components does **NOT** exist in Remix 3 — the `remix/component` subpath is not defined in remix's package.json exports.

## Solution

1. **For SSR-provided values**: Pass them as props or use cookies/session (SSR-available)
2. **For browser-side context**: Use `clientEntry` components exclusively
3. **For SSR-safe shared state**: Consider inline scripts, `data-*` attributes, or the `<Frame>` mechanism

## 📂 Codebase References

- `remix/ui` package exports — verified: `component` is NOT exported
- Project-intelligence pattern: `my_app` context uses `clientEntry` components for context (see `project-intelligence/my_app/guides/context-api-ssr.md`)

**Related**:
- `../concepts/context-api.md` — Context API concept
- `../examples/context-api.md` — Context API examples
