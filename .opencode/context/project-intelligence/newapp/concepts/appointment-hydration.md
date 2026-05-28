<!-- Context: project-intelligence/newapp/concepts/appointment-hydration | Priority: high | Version: 1.0 | Updated: 2026-05-25 -->

# Concept: Appointment Grid SSR Hydration

**Core Idea**: `clientEntry` components render on both server (SSR) and client. During SSR there is no `document` global, so DOM-reading functions throw. The component must return a placeholder matching the client root tag to avoid hydration mismatch.

---

## SSR vs Client Rendering

```
Server (SSR):          Client (After Hydration):
  HTML skeleton          Same HTML skeleton
  No DOM available       DOM is ready
  readData() throws      readData() reads #appointment-data
  Returns <div>          Returns full grid with blocks
```

## The `document` Global Problem

`readData()` in `readAppointmentData()` reads from `<script id="appointment-data">` in the DOM:

```tsx
// app/utils/appointment.ts — line 35
let el = document.getElementById('appointment-data')
```

During SSR, `document` is undefined. The try-catch returns `{}` — empty defaults. This produces "No bookable slots" fallback HTML on the server.

## Hydration Mismatch

When SSR renders a `<p>` (fallback) but the client render produces a `<div>` (real grid with appointments), the framework:
1. Renders both versions
2. Compares DOM trees
3. **Discards the client output** when they differ
4. Keeps SSR HTML permanently (the "No bookable slots" view)

This is **permanent** — the real grid never appears, even in the browser.

## The Fix: SSR Placeholder Matching Client Root

The render function checks `typeof document` at the top and returns a bare `<div>` matching the client's root tag:

```tsx
// app/ui/appointment-grid.tsx — lines 246-248
if (typeof document === 'undefined') {
  return <div mix={ssrPlaceholderWrapper}></div>
}
```

- **SSR**: Returns empty `<div>` → correct structure, no data
- **Client hydration**: Detects the `<div>`, calls render again, this time `document` exists, `readData()` works, full grid renders
- **Hydration matches**: both SSR and client produce `<div>` as root → client output is accepted

### SSR Placeholder Style

The placeholder `<div>` must be styled to occupy layout space (prevents layout shift):

```
ssrPlaceholderStyle: minHeight equivalent to grid body
```

Looking at the code, the placeholder uses `ssrPlaceholderWrapper` which maps to an empty styled wrapper (style class defined in the grid file's CSS section).

## When This Pattern Applies

Any `clientEntry` component in Remix 3 that reads from the DOM **must** use this SSR guard:

| Component | SSR Guard | Pattern |
|-----------|-----------|---------|
| `appointment-grid.tsx` | ✅ `typeof document === 'undefined'` | Empty `<div>` placeholder |
| `appointment-sidebar.tsx` | ❌ No guard needed | Sidebar relies on server-embedded JSON; `readData()` is called during render but the sidebar has no data-dependent fallback path |

The sidebar doesn't need the guard because its SSR output doesn't trigger a different tag — it would just show empty pickers during SSR, which match the client output.

### Server-Side Data Flow

The appointment page embeds all data in a `<script id="appointment-data">` tag:

```tsx
// app/ui/appointment-page.tsx — line 66
<script id="appointment-data" type="application/json">{JSON.stringify(data)}</script>
```

This data is available to both clientEntry components after hydration. The SSR never reads it — it only renders the page shell with the placeholder.

## Related Files

- [SSR & Client Scripts (standards)](../../../core/standards/concepts/ssr-client-scripts.md) — General SSR patterns
- [clientEntry Pattern Guide](../guides/client-entry-pattern.md) — clientEntry hash fragment pattern
- [Pre-built Component SSR Bridge](../errors/prebuilt-component-ssr-bridge.md) — Different SSR issue: components with client mixins not shipped
- [Appointment Calendar Architecture](./appointment-calendar.md) — Full calendar architecture
- [Shared Utilities Lookup](../lookup/shared-utilities.md) — readAppointmentData() reference
- [SSR Standards (Remix 3)](../../../development/remix3/errors/ssr-hydration.md) — General SSR/hydration patterns

## 📂 Codebase References

| File | Lines | Purpose |
|------|-------|---------|
| `app/utils/appointment.ts` | 33-41 | `readAppointmentData()` — try-catch DOM read |
| `app/ui/appointment-grid.tsx` | 246-248 | SSR guard: `typeof document === 'undefined'` placeholder |
| `app/ui/appointment-grid.tsx` | 119-130 | `readData()` wrapper — calls readAppointmentData() |
| `app/ui/appointment-page.tsx` | 51-67 | Server-embeds JSON in `<script id="appointment-data">` |
