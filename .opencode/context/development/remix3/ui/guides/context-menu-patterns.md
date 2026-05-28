<!-- Context: development/remix3/ui/guides | Priority: high | Version: 1.0 | Updated: 2026-05-27 -->

# Context Menu Patterns

Implement right-click context menus in Remix 3 using `menu.Context` + `contextTrigger()` + `MenuList`. Two approaches exist depending on whether target elements are server-rendered or live in a `clientEntry`.

---

## Pattern A: Hidden Trigger (Event Delegation)

Use when interactive elements are **server-rendered** (plain HTML/CSS in SSR).

1. Wrap `menu.contextTrigger()` on a hidden `<div>` plus `<MenuList>` in `<menu.Context>`
2. Attach a `contextmenu` listener on the **container** (table, list) via capture-phase `addEventListener`
3. On right-click: find the target row via `closest('[data-row-id]')`, store the row data, position hidden trigger at `clientX`/`clientY`, dispatch synthetic `MouseEvent('contextmenu')`
4. `contextTrigger()` picks up the event and opens the `MenuList` popover
5. `onMenuSelect` handler dispatches actions (fetch, navigate, clipboard) for the stored row

```tsx
table.addEventListener('contextmenu', (e) => {
  let tr = (e.target as Element)?.closest?.('tr[data-row-id]')
  if (!tr) return; e.preventDefault()
  lastRow = findRow(tr.getAttribute('data-row-id'))
  let trigger = document.querySelector('[data-trigger]')
  trigger.style.left = e.clientX + 'px'
  trigger.style.top = e.clientY + 'px'
  trigger.dispatchEvent(new MouseEvent('contextmenu', { clientX: e.clientX, clientY: e.clientY, bubbles: true }))
}, { capture: true, signal })
```

**Key**: The hidden trigger must use `opacity:0; pointer-events:none` (not `display:none` toggling). The synthetic event dispatches reliably and `getBoundingClientRect()` works.

---

## Pattern B: Direct Trigger (Mixin on Elements)

Use when interactive elements are **entirely within a `clientEntry`**. Apply `menu.contextTrigger()` directly as a mixin alongside `on('contextmenu')`:

```tsx
<div mix={[
  menu.contextTrigger(),
  on('contextmenu', () => { lastRightClicked = item }),
]}>...</div>
```

No hidden trigger element. `<menu.Context>` wraps the interactive elements so the mixin can consume the provider. No event delegation needed — each element handles its own right-click.

---

## Which to Choose

| Factor | Hidden Trigger | Direct Trigger |
|--------|---------------|----------------|
| Target elements | Server-rendered HTML | clientEntry-only |
| Listener setup | One `addEventListener` on container | Built into `contextTrigger()` mixin |
| Row data capture | `closest()` from `(event.target)` | Inline `on('contextmenu')` handler |
| Complexity | More code, more flexible | Less code, simpler |
| SSR guards required | Yes (`document` access) | No (already in clientEntry) |

Use **hidden trigger** when server-rendered tables/lists have right-click actions. Use **direct trigger** when the whole interactive area is client-rendered.

---

## Critical Implementation Details

### `opacity:0` vs `display:none` + `setTimeout`

| Approach | Issue |
|----------|-------|
| `display:none` + `setTimeout` | Race condition — menu may close before user sees it; `setTimeout` timing is unreliable |
| **`opacity:0`** | Trigger stays permanently invisible; synthetic `contextmenu` dispatches reliably; no timing dependency |

**Always use `opacity:0; pointer-events:none`** on hidden triggers.

### SSR Safety

`clientEntry` render functions run during SSR. All `document` access must be guarded:

```tsx
let tableEl = typeof document !== 'undefined' ? document.getElementById('nutzer-table') : null
if (!mounted && tableEl) {
  mounted = true
  attachListeners(handle.signal)
}
```

### AbortSignal Cleanup

Use `handle.signal` with `addEventListener` for automatic listener cleanup:

```tsx
table.addEventListener('contextmenu', handler, { capture: true, signal: handle.signal })
// OR
handle.signal.addEventListener('abort', () => {
  table.removeEventListener('contextmenu', handler)
})
```

### `mounted` Guard

The `ref()` callback fires on every render. Use a `mounted` flag in the clientEntry closure to attach listeners once:

```tsx
let mounted = false
// in render function:
ref((el) => {
  if (mounted) return
  mounted = true
  // attach listeners once
})
```

---

## Codebase References

- **Hidden trigger (canonical) — appointments**: `newapp/app/assets/admin-appointments-context-menu.tsx` — opacity:0, no setTimeout, ref+mounted guard, AbortSignal cleanup; hidden DELETE forms via `<div style="display:none">` in page template
- **Hidden trigger (canonical) — offerings**: `newapp/app/assets/admin-offerings-context-menu.tsx` — same pattern as appointments
- **Hidden trigger (nutzer)**: `newapp/app/assets/nutzer-table-interactive.tsx` — module-level row var, capture+signal, SSR guards, css() trigger styles
- **Direct trigger**: `newapp/app/ui/appointtype-panel.tsx` — contextTrigger() on each list item, inline on('contextmenu')

## Related

- [Context Menu (concept)](../concepts/context-menu.md) — Menu API overview
- [Client Interactivity Patterns](./client-interactivity-patterns.md) — SSR interactivity options
- [First-Party Components](../concepts/first-party-components.md) — Menu component reference
