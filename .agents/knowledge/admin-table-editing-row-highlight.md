---
title: 'Admin table editing row highlight with context menus'
tags: [admin, table, editing, context-menu, ui, remix3]
created: 2026-06-01
status: active
---

## Problem

Admin table pages used per-row action buttons (Edit/Delete) cluttering each row. The goal was to:

- Remove inline action buttons from table rows
- Replace them with a right-click context menu (Bearbeiten/Löschen)
- Highlight the row being edited with a brand-colored outline

## Solution

### 1. Editing row highlight (server-rendered)

Add an `editingRowStyle` and conditionally apply it via `mix` array on the `<tr>`:

```tsx
const editingRowStyle = css({
  outline: `2px solid ${theme.colors.action.primary.background}`,
  outlineOffset: '-2px',
  backgroundColor: theme.surface.lvl0,
})

// In the row map:
<tr key={row.id} mix={[table.row, editRow?.id === row.id ? editingRowStyle : undefined]} data-row-id={row.id}>
```

The `mix` array with conditional `undefined` values works in both server-rendered and `clientEntry` components.

### 2. Context menu (clientEntry asset)

Create a `clientEntry` asset that attaches a right-click handler to the table:

```tsx
// app/assets/admin-xxx-context-menu.tsx
import { clientEntry, ref, type Handle } from 'remix/ui'
import * as menu from 'remix/ui/menu'
import { MenuItem, MenuList, onMenuSelect } from 'remix/ui/menu'

export const AdminXxxContextMenu = clientEntry(
  import.meta.url + '#AdminXxxContextMenu',
  function AdminXxxContextMenu(handle: Handle) {
    // ... see admin-appointments-context-menu.tsx for full pattern
  },
)
```

Key elements:

- `menu.Context` wrapper with `menu.contextTrigger()` on a hidden positioned div
- Event delegation on `[data-xxx-table]` for `contextmenu` events
- `data-row-id` attributes on `<tr>` elements for row identification
- Hidden DELETE forms rendered server-side with `data-delete-form={row.id}`
- Grid-state JSON (`#xxx-grid-state`) for preserving sort/filter/pagination on edit navigation

### 3. Theme brand accent

Use `theme.colors.action.primary.background` for the brand accent color. This is part of the standard Remix theme contract and works in both server and client components. Do NOT use `theme.colors.brand.accent` — the `brand` property is not in the theme type definition.

## Why

- The `mix` array with conditional styles works in server-rendered Remix components, not just `clientEntry`
- Context menus declutter the table and match modern admin UI patterns
- Using `theme.colors.action.primary.background` avoids asset server import restrictions (the asset server only allows `app/assets/**`, `app/ui/**`, `app/routes.ts`, `app/lib/**`, `app/utils/**`, `node_modules/**`)
- Hidden DELETE forms keep the CSRF token management server-side instead of requiring fetch with custom headers
