<!-- Context: project-intelligence/newapp/guides/admin-context-menu-pattern | Priority: high | Version: 1.2 | Updated: 2026-05-27 -->

# Guide: Admin Table Right-Click Context Menu

**Purpose**: Right-click context menus on admin tables using event delegation + `menu.Context` + `contextTrigger()` + `MenuList`. Three implementations evolved from a fragile pattern to a clean canonical one.

---

## Architecture

Server renders table as plain HTML/CSS with `data-row-id`. `clientEntry` mounts alongside with hidden trigger (`menu.contextTrigger()`) and `<MenuList>`. Event delegation on `<table>` captures right-clicks, stores row data, positions hidden trigger at click coords, dispatches synthetic `contextmenu` to open the menu.

```
Server Render            ClientEntry
┌──────────────────┐    ┌───────────────────────┐
│ <table>          │    │ menu.Context          │
│ ├─ data-row-id   │    │  ├─ <div contextTrigger ▶ opacity:0, positioned
│ ├─ data-row-id   │    │  └─ MenuList + onMenuSelect
│ └─ ...           │    └──addEventListener('contextmenu', { capture, signal })
└──────────────────┘
<script id="table-data"> ← JSON row data for client
<ClientEntry />           ← clientEntry mount
```

## Pattern Evolution

### Pattern 1 — Fragile (nutzer-table-interactive, original)
- Hidden trigger with `display:none` toggled via `setTimeout(() => trigger.style.display = 'none', 100)`
- Race condition: menu could close before user interacts
- Module-level `lastRightClickedRow` variable
- Manual listener cleanup in signal handler

### Pattern 2 — Structural Rewrite (appointtype-panel)
- `menu.contextTrigger()` applied directly on each list item via mix array
- Inline `on('contextmenu', () => { lastRightClickedType = t })` alongside trigger
- No hidden trigger — `<menu.Context>` wraps interactive elements directly
- Cleaner for clientEntry-only components, but doesn't work with server-rendered HTML

### Pattern 3 — Canonical (admin-appointments-context-menu) ✅
- Hidden trigger with `opacity:0; pointer-events:none` (no `setTimeout`)
- `ref()` callback with `mounted` guard for one-time listener attachment
- `handle.signal.addEventListener('abort')` for cleanup
- Local closure variable for right-clicked row ID
- All `document` access inside guarded `clientEntry` render

## Step 1: Routes

```ts
nutzer: route('nutzer', {
  index: get('/'), create: post('/'), update: put('/:id'), destroy: del('/:id'),
  resetPassword: post('/:id/reset-password'),
  toggleLock: post('/:id/toggle-lock'),
  toggleActive: post('/:id/toggle-active'),
}),
```

## Step 2: Controller Actions

Each action: parse JSON from `context.request.json()`, validate, execute SQL, return `Response.json()`. Key: `X-Csrf-Token` header, `Response.json({ ok: true, ... })`.

## Step 3: Server Page Changes

1. **Remove Actions column** — delete per-row `<td>` buttons
2. **Add `data-row-id` to each `<tr>`** — for `closest('[data-row-id]')` in delegation
3. **Add JSON data script** — `<script id="table-data" type="application/json">` with rows, pagination state
4. **Mount clientEntry** — at bottom of grid section

## Step 4: ClientEntry (Canonical Pattern)

### 4a. Event delegation on container

```ts
let lastRowId: string | null = null  // closure variable

table.addEventListener('contextmenu', (e) => {
  let mouseEvent = e as MouseEvent
  let row = (mouseEvent.target as Element)?.closest?.('[data-row-id]') as HTMLElement | null
  if (!row) return; mouseEvent.preventDefault()

  lastRowId = row.dataset.rowId ?? null

  let trigger = document.querySelector('[data-trigger]')
  trigger.style.left = mouseEvent.clientX + 'px'
  trigger.style.top = mouseEvent.clientY + 'px'
  trigger.dispatchEvent(new MouseEvent('contextmenu', {
    clientX: mouseEvent.clientX, clientY: mouseEvent.clientY, bubbles: true,
  }))
}, { capture: true, signal: handle.signal })
```

### 4b. Menu with hidden trigger (`opacity:0`)

`contextTrigger()` attaches popover behavior — dispatching `contextmenu` on it opens the `MenuList`:

```tsx
<menu.Context label="Actions">
  <div mix={[menu.contextTrigger()]}
       style="position:fixed;width:0;height:0;opacity:0;pointer-events:none"
       data-trigger="true" />
  <MenuList mix={onMenuSelect((event) => {
    if (lastRowId) handleAction(lastRowId, event)
  })}>
    <MenuItem name="edit">Bearbeiten</MenuItem>
    <div role="separator" />
    <MenuItem name="delete">Löschen</MenuItem>
  </MenuList>
</menu.Context>
```

### 4c. Action dispatching

`fetch()` with `X-Csrf-Token` header. Use `window.location.reload()` for full-page tables; `handle.frame?.reload()` for frame-based tables.

## Adding to Other Admin Tables

1. Add POST routes → 2. Add JSON controller actions → 3. Page: remove Actions, add `data-row-id`, JSON script, mount clientEntry → 4. Create clientEntry following the canonical pattern.

**Frame-based tables**: Use `handle.frame?.reload()` instead of `window.location.reload()`. Event delegation survives Frame DOM swaps. JSON script must be inside Frame fragment.

## Key Technical Details

| Detail | Guideline |
|--------|-----------|
| Trigger CSS | `opacity:0; pointer-events:none` — **never** `display:none` + `setTimeout` |
| Listener cleanup | `{ capture: true, signal: handle.signal }` or `handle.signal.addEventListener('abort', ...)` |
| SSR safety | Guard all `document` access: `typeof document !== 'undefined'` |
| One-time attach | `mounted` flag in `ref()` callback prevents duplicate listener registration |
| Row data storage | Prefer closure variable within `clientEntry`; module-level works but is less encapsulated |
| `contextTrigger()` | Calls `stopPropagation()` — other listeners on trigger element still fire |

---

## 📂 Codebase References

- **Pattern 3 (canonical) — appointments**: `app/assets/admin-appointments-context-menu.tsx` — opacity:0, ref+mounted guard, AbortSignal cleanup; `app/ui/admin-appointments-page.tsx` — hidden DELETE forms via `<div style="display:none">` for `.requestSubmit()`
- **Pattern 3 (canonical) — offerings**: `app/assets/admin-offerings-context-menu.tsx` — identical pattern; `app/ui/admin-offerings-page.tsx` — data-offerings-table, offerings-grid-state script
- **Pattern 2 (direct trigger)**: `app/ui/appointtype-panel.tsx` — contextTrigger() on elements, no hidden trigger
- **Pattern 1 (fragile, migrated)**: `app/assets/nutzer-table-interactive.tsx` — module-level row var, capture+signal, SSR guards, css() trigger styles
- **JSON endpoints**: `app/actions/admin-nutzer-controller.tsx`
- **Page**: `app/ui/admin-nutzer-page.tsx`
- **Routes**: `app/routes.ts` — `admin.nutzer` tree (lines 79-87)

## Current Implementation Status (2026-05-27)

| Admin Page | Context Menu | Action Buttons | Pattern |
|------------|-------------|----------------|---------|
| Nutzer | ✅ Right-click → Edit, Reset PW, Lock/Unlock, Copy Email, Delete | Removed (context menu only) | Hidden trigger (canonical) |
| Appointtypes | ✅ Right-click → Edit, Delete | Removed (context menu only) | Direct trigger on items |
| Appointments | ✅ Right-click → Edit, Delete | Removed — hidden forms kept for `.requestSubmit()` | Hidden trigger (canonical) |
| Offerings | ✅ Right-click → Edit, Delete | Visible buttons (not yet removed) | Hidden trigger (canonical) |

## Related

- [Context Menu Patterns](../../development/remix3/ui/guides/context-menu-patterns.md) — General Remix 3 guide
- [Context Menu (concept)](../../development/remix3/ui/concepts/context-menu.md) — Menu API overview
- [JSON Endpoint Admin Actions](../concepts/json-endpoint-admin-actions.md) — JSON API pattern
- [clientEntry Pattern](./client-entry-pattern.md) — Hash fragment + zero-arg RenderFn
- [First-Party Components: Menu](../../development/remix3/ui/concepts/first-party-components.md)
