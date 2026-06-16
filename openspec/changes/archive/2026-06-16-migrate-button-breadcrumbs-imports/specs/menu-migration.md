# Menu import migration

## Files (7 files)

- `app/assets/admin-appointments-context-menu.tsx`
- `app/assets/admin-offering-configs-context-menu.tsx`
- `app/assets/admin-offerings-context-menu.tsx`
- `app/assets/admin-resources-context-menu.tsx`
- `app/assets/admin-users-context-menu.tsx`
- `app/assets/nutzer-table-interactive.tsx`
- `app/ui/appointtype-panel.tsx`

## Change

Each file has a dual import pattern. The styled names move:

```diff
  import * as menu from 'remix/ui/menu'
- import { MenuItem, MenuList, onMenuSelect } from 'remix/ui/menu'
+ import { MenuItem, MenuList, onMenuSelect } from 'remix/components/menu'
```

The namespace import (`import * as menu`) stays at `remix/ui/menu` — it provides `menu.Context`, `menu.contextTrigger()`, etc. which are still headless primitives.

## Verification

All three named exports (`MenuItem`, `MenuList`, `onMenuSelect`) exist in the styled `remix/components/menu` with identical APIs. Context menus should work identically.
