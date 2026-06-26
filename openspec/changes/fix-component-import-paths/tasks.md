## 1. Vendor scroll-lock

- [x] 1.1 Copy `lockScroll` from `packages/ui/src/popover/scroll-lock.ts` to `app/lib/scroll-lock.ts`
- [x] 1.2 Update `app/assets/appointments-scroll-lock.tsx` to import from `app/lib/scroll-lock`
- [x] 1.3 Update `app/assets/nav-toggle.tsx` to import from `app/lib/scroll-lock`

## 2. Migrate button to mixin API

- [x] 2.1 Update import: `import { Button } from 'remix/ui/button'` → `import button from 'remix/ui/button'` (29 files)
- [x] 2.2 Replace each `<Button>` with `<button mix={[button({...})]}>` across all files (80 usages in 27 files)

## 3. Fix menu primitives split

- [x] 3.1 Update files that use `menu.Context`/`menu.contextTrigger` to import `* as menu` from `remix/ui/menu/primitives` (7 files)
- [x] 3.2 Update files that use `onMenuSelect` to import from `remix/ui/menu/primitives`
- [x] 3.3 Keep `MenuItem`/`MenuList` imports from `remix/ui/menu`

## 4. Verify

- [x] 4.1 Run `rg "remix/components/" app/` — confirm zero remaining matches
- [x] 4.2 Run `tsc --noEmit` — confirm no module-resolution errors
- [x] 4.3 Run tests — confirm no regressions (720 pass, 0 fail)
