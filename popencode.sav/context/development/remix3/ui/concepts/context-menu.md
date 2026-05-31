<!-- Context: development/remix3/ui/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-27 -->

# Context Menu

**Core Idea**: Right-click context menus via `menu.Context` + `contextTrigger()` + `MenuList`. A hidden trigger element positioned at mouse coordinates dispatches a synthetic `contextmenu` event to open the popover.

## Key Points

- **Three pieces**: `menu.Context` (invisible provider), `menu.contextTrigger()` (mixin on hidden element), `MenuList` + `MenuItem` (menu content with `onMenuSelect`)
- **`contextTrigger()` calls `stopPropagation()`**, not `stopImmediatePropagation()` — other listeners on the same element still fire
- **`menu.Context` renders no visible DOM** — no layout impact when placed anywhere in the tree
- **Two approaches**: hidden trigger (event delegation on server-rendered elements) vs direct trigger (`contextTrigger()` as mixin on each interactive element)
- **SSR requirement**: all `document` access in `clientEntry` must be guarded with `typeof document !== 'undefined'`

## Minimal Example

```tsx
<menu.Context label="Actions">
  <div mix={menu.contextTrigger()}
       style="position:fixed;width:0;height:0;opacity:0;pointer-events:none" />
  <MenuList mix={onMenuSelect((event) => {
    if (lastRow) handleAction(lastRow, event)
  })}>
    <MenuItem name="edit">Edit</MenuItem>
    <MenuItem name="delete">Delete</MenuItem>
  </MenuList>
</menu.Context>
```

## Related

- [Context Menu Patterns (guide)](../guides/context-menu-patterns.md) — implementation details, two approaches
- [First-Party Components](./first-party-components.md) — Menu component overview
- [Client Entry Error Handling](../guides/client-entry-error-handling.md) — SSR safety patterns
