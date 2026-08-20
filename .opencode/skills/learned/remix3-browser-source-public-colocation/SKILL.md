---
name: remix3-browser-source-public-colocation
description: "Colocate Remix 3 browser source in <route>/public/ — and the two traps: git mv breaks internal ./ and ../ sibling imports, and allowFiles must keep app/ui/** broad when public/ components import shared ui/ helpers."
user-invocable: false
origin: auto-extracted
---

# Remix 3 Browser Source Colocation into `public/`

**Extracted:** 2026-08-20
**Context:** Moving browser (`.browser.*`) source out of `app/ui/` into route-owned `app/actions/<group>/public/` dirs, matching the upstream Remix demo convention (commit `5ec6f308b`). Applies when relocating browser code or adding a new route-owned browser component.

## Problem
Two silent traps when relocating browser source into `public/` directories:

1. **`git mv` breaks internal relative imports.** A browser component at `app/ui/foo.browser.tsx` imports its sibling helpers via `./` and `../` (e.g. `./toast.ts`, `../theme/theme.ts`). After `git mv` to `app/actions/<group>/public/foo.tsx`, those paths resolve to the wrong directory and the module graph breaks. TypeScript surfaces this as `TS2307`; the asset server silently fails to bundle the graph.

2. **`allowFiles` narrowing breaks shared helpers.** If you narrow `allowFiles` to `app/**/*.browser.*`, moved `public/` components that import shared `app/ui/` helpers (e.g. `theme/theme.ts`, `auto-grow-textarea.ts`, `agent-prefill-store.browser.ts`) lose those helpers — they are neither `.browser.*` nor inside a `public/` dir. The whole dependency graph must match `allowFiles`.

## Solution

### Move with `git mv` (preserves history), then fix sibling imports
Count directory depth from the new `public/` location back to `app/`:
- `app/actions/<group>/public/` → `../../../` to reach `app/`
- `app/actions/<group>/<sub>/public/` → `../../../../` to reach `app/`

```ts
// file moved to app/actions/admin/public/admin-users-context-menu.tsx
import { theme } from '../../../ui/theme/theme.ts'   // was ./theme/theme.ts
import { showToast } from '../../../ui/toast.ts'     // was ./toast.ts
```

### Keep `app/ui/**` broad in `allowFiles`
The vendor guidance says "keep the whole graph inside `public/`", but this app's browser components legitimately import shared `ui/` helpers. Keep the broad glob:

```ts
allowFiles: [
  'app/**/public/**',          // route-owned + stream browser source
  'app/ui/**',                 // shared browser components AND their ui/ helpers (broad!)
  'app/assets/entry.tsx',
  'app/assets/frame-response.browser.tsx',
  'app/assets/error-card.browser.tsx',
  'app/routes.ts',
  'app/utils/**',
],
```

### Revert a move when a component is a shared subsystem
If a browser component depends on a tightly-coupled cluster of `app/ui/` helpers also consumed by `app/ui` tests and other pages (e.g. the appointment-grid cluster: `schedule-layout`, `appointment-grid-lib/types/styles`, `toast`, `mixins/icon`), it is a shared subsystem, not route-owned — leave it in `app/ui/`. Only genuinely route-owned, self-contained components belong in `<route>/public/`.

## When to Use
- Relocating browser (`.browser.*`) source into `app/**/public/` directories
- Adding a new route-owned browser component and deciding where it lives
- Rewriting `assetServer.allowFiles` and hitting `TS2307` or silently-unserved assets after a move
- Verifying whether a browser component is route-owned vs a shared `ui/` subsystem
