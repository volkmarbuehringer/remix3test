# Migrate Remix UI imports to styled component paths

## What

Update import paths across ~37 files to match the upstream Remix UI package restructuring that split headless primitives (`remix/ui/*`) from styled components (`remix/components/*`).

## Why

The upstream `remix` package removed the old styled-component re-exports:

| Removed path | Replacement |
|---|---|
| `remix/ui/button` | `remix/components/button` |
| `remix/ui/breadcrumbs` | `remix/components/breadcrumbs` |
| `remix/ui/menu` (partial — `MenuItem`, `MenuList`) | `remix/components/menu` |

The headless primitive path (`remix/ui/menu`) still exists for `menu.Context`, `menu.contextTrigger()`, etc. Only the styled component names moved.

Additionally, the `on()` mixin's event type parameter tightened, causing type errors on `on('click', handler)` patterns in one file.

## Scope

Three migration categories + one type fix:

1. **Button path** — 29 files, simple import swap
2. **Breadcrumbs path** — 1 file (re-export wrapper), import + type import swap
3. **Menu path** — 7 files, split imports: styled names go to `remix/components/menu`, primitives stay at `remix/ui/menu`
4. **`on('click')` type error** — 12 occurrences in `lists-client.tsx`
