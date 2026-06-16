# Tasks — Import migration

- [x] **Task 1: Button imports (29 files)** — `remix/ui/button` → `remix/components/button`
- [x] **Task 2: Breadcrumbs imports (1 file)** — `remix/ui/breadcrumbs` → `remix/components/breadcrumbs`
- [x] **Task 3: Menu imports (7 files)** — `MenuItem`/`MenuList` to `remix/components/menu`, `onMenuSelect` stays at `remix/ui/menu`
- [x] **Task 4: `on('click')` type fix** — Resolved as cascading error from broken imports, no separate fix needed

## Verification

```sh
npm run typecheck
```

Passed with zero errors.
