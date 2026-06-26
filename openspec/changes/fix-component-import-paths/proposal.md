## Why

Upstream Remix restructured its UI component library (commit `9fb5c4f78`, Component work #11568), moving public exports from `remix/components/*` to `remix/ui/*` and removing `remix/ui/scroll-lock` from the public API surface. The app tracks `remix#preview/main` — imports are now broken.

## What Changes

- Update all `remix/components/button` imports to `remix/ui/button` (29 files)
- Update all `remix/components/breadcrumbs` imports to `remix/ui/breadcrumbs` (1 file)
- Update all `remix/components/menu` imports to `remix/ui/menu` (7 files)
- Vendor a local copy of `lockScroll` since `remix/ui/scroll-lock` was removed upstream (2 files)
- No behavior changes — purely mechanical import path updates

## Capabilities

### New Capabilities

- `component-import-paths`: Update all imports from `remix/components/*` to `remix/ui/*` to match upstream restructuring
- `scroll-lock-vendor`: Vendor the `lockScroll` utility locally after upstream removal of `remix/ui/scroll-lock`

### Modified Capabilities

None.

## Impact

- 37 source files across `app/ui/`, `app/actions/`, and `app/assets/` need import path updates
- 2 asset files (`appointments-scroll-lock.tsx`, `nav-toggle.tsx`) need scroll-lock from a local module instead of `remix/ui/scroll-lock`
- No API or behavior changes — all imports resolve to the same underlying implementations
