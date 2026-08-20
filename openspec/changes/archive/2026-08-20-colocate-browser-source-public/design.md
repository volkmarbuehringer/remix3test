# Design: Colocate Browser Source in `public/`

## Context

See proposal.md — Why. This is a structural refactor of where browser source lives. The app currently selects browser files by a `.browser.*` filename suffix (`allowFiles: ['app/**/*.browser.*', ...]` in `app/assets.ts`). The upstream Remix demos (commit `5ec6f308b`) select by location (`app/**/public/**`), colocating browser source next to the owning route.

Key current-state facts driving the design:
- 24 browser files live under `app/ui/`, but most are route-owned and only 2 (`confirm-delete`, `connection-indicator`) are genuinely cross-route shared.
- 5 browser files already sit in `app/actions/lists/` (co-located with the route) but still use the `.browser.` suffix.
- 6 agent-stream components live in `app/assets/streams/`.
- Entry plumbing (`entry.tsx`, `frame-response`, `error-card`) lives in `app/assets/` and is not route-owned.

## Goals / Non-Goals

**Goals**
- Adopt the upstream `<route>/public/` convention for route-owned browser source.
- Collapse the route-owned allow-list to a single location glob `app/**/public/**`.
- Keep shared/global browser components in `app/ui/` (minimal move surface).
- Preserve git history via `git mv`.

**Non-Goals**
- No runtime behavior change: served asset URLs and responses are unchanged.
- No `ui/public/` tier — rejected (see Decisions). Shared components stay in `ui/`.
- No per-agent-route scattering of streams (Option A chosen).
- Not migrating the DB lifecycle (that is a separate change).

## Decisions

### Decision 1: Two tiers, not three — no `ui/public/`

**Choice:** Route-owned browser code → `<route>/public/`; shared/global browser code stays in `app/ui/*.browser.tsx`.

**Rationale:** Only 2 of 24 `ui/` browser files are genuinely cross-route shared (`confirm-delete` with 8 consumers, `connection-indicator` with 4). A `ui/public/` tier would hold ~4 files (2 shared + 2 global shell), which is overhead rather than structure — `ui/` already *means* "shared UI." The real win is moving the ~15 route-owned files out of `ui/` into their owning routes.

**Alternatives considered:**
- Full `ui/public/` tier: rejected — near-empty bucket, doesn't fix the actual scattering.
- Move everything to `<route>/public/` including shared: rejected — `confirm-delete`/`connection-indicator` are used by disparate route trees (client, lists, webhook, appointment, admin) and have no single owner.

**Implementation revision (post-hoc):** The appointment browser components (`appointment-grid`, `appointment-sidebar`, `appointtype-panel`, `appointments-scroll-lock`) were initially moved to `app/actions/appointment/public/`, but this broke their dependency graph: they import a tightly-coupled cluster of helper modules in `app/ui/` (`schedule-layout`, `appointment-grid-lib/types/styles`, `appointment-interaction-state`, `toast`, `mixins/icon`) that are also consumed by `app/ui` tests and other pages. This cluster is a shared `ui/` subsystem, not self-contained route-owned code. **The appointment components were reverted to `app/ui/`** as a shared subsystem. The genuinely route-owned files (lists, admin context-menus, nutzer, chatlog, webhook-composer, grid-refresh-button) and streams moved cleanly.

### Decision 2: Streams grouped under `app/assets/streams/public/` (Option A)

**Choice:** Move all 6 stream components to `app/assets/streams/public/`.

**Rationale:** Each stream is consumed by a `ui/*-page.tsx`, not by a single route controller, so there's no clean per-route owner. Grouping them under `assets/streams/public/` keeps stream plumbing together and is caught by `app/**/public/**`. Option B (scatter to each agent route) would spread 6 files across 6 dirs and change their page imports for no ownership gain.

### Decision 3: Entry plumbing stays in `app/assets/` with explicit allow-list entries

**Choice:** `entry.tsx`, `frame-response.browser.tsx`, `error-card.browser.tsx` remain in `app/assets/` and are listed explicitly in `allowFiles`.

**Rationale:** They are entry/frame plumbing, not route-owned browser source. They don't fit the `public/` model, so explicit entries are the honest representation. `frame-response` and `error-card` keep their `.browser.` suffix (they're not in a `public/` dir).

### Decision 4: Allow-list by location

**Choice:** `allowFiles` becomes:
```ts
allowFiles: [
  'app/**/public/**',               // route-owned + streams
  'app/ui/**',                      // shared browser components AND shared ui helpers
  'app/assets/entry.tsx',           // client entry
  'app/assets/frame-response.browser.tsx',
  'app/assets/error-card.browser.tsx',
  'app/routes.ts',
  'app/utils/**',
],
```

**Rationale:** `app/**/public/**` selects route-owned/stream browser source by location. `app/ui/**` is kept **broad** (not narrowed to `app/ui/**/*.browser.*`) because the moved browser components depend on shared `ui/` helper modules that are NOT `.browser.*` and not in a `public/` dir — e.g. `app/ui/theme/theme.ts`, `app/ui/auto-grow-textarea.ts`, `app/ui/agent-prefill-store.browser.ts` — which the narrow glob would block, breaking the asset graph. Explicit entries cover entry plumbing; `app/routes.ts` and `app/utils/**` are retained as before. `fileMap`, `allowPackages`, `denyFiles` unchanged.

## Risks / Trade-offs

- [Import path churn] → Mitigate with `git mv` and a grep-driven pass; imports change from `../../ui/<name>.browser.tsx` to `./public/<name>.tsx` (route-owned) or stay `../../ui/...` (shared). Verify with `typecheck` + `remix test`.
- [Asset test assertions break] → Update `app/assets/*.test.browser.ts` and any `getPreloads`/`getHref` calls referencing old paths.
- [`app/**/public/**` accidentally serves non-browser code] → `public/` only contains browser source by convention; server modules never live there. The existing `denyFiles`/server-split is unchanged.
- [Shared components misclassified as route-owned] → The 2-file shared set is small and explicit; keep them in `ui/` and document the rule (see spec).

## Migration Plan

1. `git mv` route-owned browser files into their `<route>/public/` dirs, dropping `.browser.` suffix.
2. `git mv` stream files into `app/assets/streams/public/`.
3. Update all import statements in server modules (controllers, page components).
4. Rewrite `allowFiles` in `app/assets.ts`.
5. Update asset tests to new paths.
6. Verify: `npm run typecheck`, `npm test`, manual smoke of a frame-rendered route.

Rollback: `git revert` — moves are pure relocations, no schema/data impact.

## Open Questions

None. The tier structure, streams placement (Option A), appointment-cluster revert, and allow-list shape are all resolved and validated during implementation (typecheck + asset smoke test).
