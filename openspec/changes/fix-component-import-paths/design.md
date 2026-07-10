## Context

Upstream Remix commit `9fb5c4f78` ("Component work") restructured `packages/ui`:

- `remix/components/button` → `remix/ui/button`
- `remix/components/breadcrumbs` → `remix/ui/breadcrumbs`
- `remix/components/menu` → `remix/ui/menu`
- `remix/ui/scroll-lock` removed from public exports (internal popover detail)

The app uses `remix` from `remix#preview/main` (github dependency) and currently imports from the old paths. A previous change (`2026-06-16-migrate-button-breadcrumbs-imports`) had moved **to** `remix/components/*` when those were the correct upstream paths. Now the upstream moved back to `remix/ui/*`.

## Goals / Non-Goals

**Goals:**

- Update all `remix/components/*` imports to `remix/ui/*` so the app resolves correctly against upstream `preview/main`
- Vendor `lockScroll` locally since it's no longer a public export
- Zero behavioral changes — all imports resolve to the same implementations

**Non-Goals:**

- No refactoring of how components are used
- No changes to component APIs or usage patterns
- No updates to `remix/ui/menu` primitives imports — those still resolve correctly

## Decisions

1. **Vendor scroll-lock as a local module** — The upstream `scroll-lock.ts` (73 lines, `packages/ui/src/popover/scroll-lock.ts`) is self-contained with a `WeakMap<Document, ...>` refcounting pattern. Copy it to `app/lib/scroll-lock.ts` and update the two asset file imports. This avoids depending on an internal module path that could break again.

2. **Button: mixin, not component** — The upstream `remix/ui/button` changed from a `<Button>` component to a `button(options)` mixin function. Every usage of `<Button tone="primary" mix={...}>` becomes `<button mix={[button({ tone: 'primary' }), ...]}>`. The import changes from `import { Button }` to `import button` (default export).

3. **Menu exports split across styled and primitives** — `MenuItem`, `MenuList`, `Submenu` remain in `remix/ui/menu` (styled wrapper). `menu.Context`, `menu.contextTrigger`, `onMenuSelect` moved to `remix/ui/menu/primitives`. Files using both must import from both paths.

4. **Breadcrumbs unchanged** — `Breadcrumbs` remains a component export at `remix/ui/breadcrumbs`. Only the path changed.

## Risks / Trade-offs

- **Missed files** → Run `rg "remix/components/" app/` after the migration to verify zero remaining matches. Also run `tsc --noEmit` and tests.
- **Multiple upstream restructures** → This is the second time the paths moved. If the upstream restructures again, the `app/lib/scroll-lock.ts` vendoring insulates us from future scroll-lock removal.
- **`remix/ui/menu` primitives vs styled exports** → Files that import `* as menu` and use `menu.Context`/`menu.contextTrigger` must now import from `remix/ui/menu/primitives`. Files importing `MenuItem`/`MenuList` use `remix/ui/menu`. Files that need both must import from both paths.
- **Button mixin migration** → 29 files use `<Button>` as a JSX element. Each `<Button>` must become `<button>` with the mixin applied via `mix={[button(), ...]}`. This changes the DOM output but preserves the same visual result. Risk: props like `type`, `onClick`, `disabled` move from component props to native `<button>` attributes.
- **`app/lib/scroll-lock` type resolution** → TypeScript needs to resolve `app/lib/scroll-lock`. The app already has a `paths` config for `app/lib/*` aliases — if not, configure in `tsconfig.json`.
- **Upstream button tone types** → The upstream remix `ButtonTone` only includes `'neutral' | 'primary' | 'ghost'`. The app needs `'secondary'` (alias for neutral) and `'danger'` (red destructive style). A local wrapper `app/lib/button.ts` handles this: `secondary` delegates to upstream `tone: 'neutral'`, `danger` uses `tone: 'primary'` plus a custom danger CSS mixin. All 27 files import from `../lib/button.ts` — no node_modules patching needed.
