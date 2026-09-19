---
name: remix3-build-and-tooling
description: "Use when configuring how a Remix 3 app is served and built — asset-server config in `remix.json` (`loadConfig` + `config.assets`, `mounts`/`denyFiles`), colocating browser source under a route's `public/` and the `allowFiles` graph, and the `remix` CLI / `node-tsx` loader."
user-invocable: false
origin: consolidated
---

# Remix 3 Build and Tooling

**Consolidated from:** `remix3-browser-source-public-colocation`, `remix3-assets-config-inspection`, `remix-cli-devops`

This skill is the **index** for how a Remix 3 app's asset server is configured, how browser source is laid out for it, and how the `remix` CLI / `node-tsx` loader are driven. For the asset-server, CLI, and loader APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

## Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| Making `remix.json` the asset-server source of truth (`loadConfig` + spread `config.assets`), `mounts` vs the removed `fileMap`, `denyFiles` precedence, or debugging with `remix assets` / `remix assets inspect` and `AssetStatus` | `references/assets-config-inspection.md` |
| Relocating `.browser.*` source into `<route>/public/`; `git mv` breaking sibling `./`/`../` imports (`TS2307`, silently un-bundled graph); a `ui/` module importing a non-public `app/actions/**` module that resolves `not-allowed`; tuning `allowFiles` | `references/browser-source-public-colocation.md` |
| Running `remix new` / `test` / `doctor` / `routes` / `version` / `completion`, programmatic `runRemix`, wiring `node --import remix/node-tsx` or `loadModule`, the `node-tsx` tsconfig, `remix test` filters, `NODE_ENV=test`, or mocking frozen ES-module exports | `references/cli-devops.md` |

## Core Rules

**Browser source colocated under a route's `public/` (`references/browser-source-public-colocation.md`)**

- `git mv`-ing `.browser.*` source into `app/actions/<group>/public/` preserves history but breaks every sibling relative import (`./`/`../`) — `TS2307` and a silently un-bundled asset graph. Count depth back to `app/` when fixing them (`…/<group>/public/` → `../../../`, one level deeper → `../../../../`), and keep `app/ui/**` broad in `allowFiles`: the **whole** dependency graph (`public/`, `.browser.*`, and shared `app/ui/` helpers) must match the glob, not just `public/`.
- `allowFiles` admits `app/ui/**` and `app/utils/**` but **not** non-public `app/actions/**`, so a `ui/` page importing an actions module leaves a dormant `reachable → not-allowed` edge that surfaces only once the page enters a client graph. Move the shared value to `app/utils/` and re-export it from the actions module to keep importers working; confirm edges with `remix assets inspect <file>` (`reachable` vs `not-allowed`). Revert a move when the component is really a shared subsystem (e.g. the appointment-grid cluster) rather than route-owned.

**Shared asset config + inspector (`references/assets-config-inspection.md`)**

- Make `remix.json → assets` the single source of truth and spread `config.assets` into `createAssetServer` via `loadConfig` (it accepts a file or directory and searches upward for `remix.json`; needs top-level `await`), keeping only runtime options (`watch`, `hmr`, `fingerprint`, `target`, `sourceMaps`, `scripts`, `minify`) in code. Debug with `remix assets` (`url -> file`) and `remix assets inspect <url-or-file>` (`Status`, `URL`, `File`, `Denied by:`); `AssetStatus` is `reachable | missing | denied | not-allowed | unmapped | unsupported`, and `denyFiles` outranks `allowFiles`/`allowPackages`, setting `access.deniedBy`.
- The strict `parseAssetsConfig` rejects unknown properties — `fileMap` now throws, so use directory-based `mounts` (keys are URL segments relative to `basePath`, values are directories relative to `rootDir`, recursing; default `{ app: 'app', npm: 'node_modules' }` serves node_modules at `/assets/npm/...`). `denyFiles` is path-scoped (`app/**/*.server.*`, `app/**/*.test.*`): vendor `node_modules` test files stay reachable, and app test files are hidden from `/assets` **without** breaking browser tests (the test runner uses its own server). The `node_modules` mount makes the whole allowed dep tree reachable (~2500 lines — filter `^/assets/app/`, never pipe through `head`), and #11814 auto-mounts `/__@remix/virtual-store` only when the store is outside `rootDir` (not this app, whose `.pnpm` is inside the mount).

**`remix` CLI + `node-tsx` (`references/cli-devops.md`)**

- `remix new <dir>`, `remix test`, `remix doctor [--fix]`, `remix routes [--table]`, `remix version`, `remix completion bash|zsh`, plus programmatic `runRemix` from `remix/cli`. `remix routes` discovers only the **first/default** export of `routes.ts` — independently mounted named trees run but stay invisible — and `remix test` takes a positional glob with `--type=server|browser|e2e` (no `--run`), does **not** auto-set `NODE_ENV=test`, and supports `--coverage`.
- Register the TypeScript/JSX loader with `remix/node-tsx` (`node --import remix/node-tsx ./server.ts`, side-effect `import 'remix/node-tsx'`, scoped `loadModule` from `remix/node-tsx/load-module`) under `module`/`moduleResolution: NodeNext`, `allowImportingTsExtensions`, `isolatedModules`, `verbatimModuleSyntax`, and `rewriteRelativeImportExtensions`. `mock.method(obj, name)` cannot spy frozen ES-module named exports, so prefer side-effect/DOM testing or wrap the export in a mutable object (`export let scrollLock = { … }`).

## When to Use

- You are wiring or diagnosing the asset server: moving static mapping/access config into `remix.json → assets`, adopting `loadConfig` + `config.assets`, migrating `fileMap` to `mounts`, reasoning about `denyFiles` precedence, or asking what is actually reachable with `remix assets` / `remix assets inspect`.
- You are relocating or adding browser (`.browser.*`) source and need to know where it belongs (`<route>/public/` vs shared `app/ui/`), how `git mv` changes relative-import depth, or whether an import is servable under `allowFiles`.
- You are running the `remix` CLI (scaffold, tests, doctor, routes), setting up `node-tsx` to execute TypeScript/JSX directly, filtering `remix test` by type, setting `NODE_ENV=test`, or working around frozen ES-module exports in tests.

## Related Skills

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical asset-server, CLI, `node-tsx`, and convention APIs these deltas build on
- `remix3-route-wiring` (`references/route-relocation.md`) — moving routes between trees; its relative-import-depth checklist points here for `public/` client entries
- `remix3-route-wiring` (`references/standalone-route-admin-sidebar.md`) — registering standalone routes outside the route tree; the CLI route-tree discovery note now lives here
- `remix3-client-entries` — the browser behavior that runs inside the colocated `clientEntry` modules
- `remix3-testing` — Remix 3 test-suite patterns, including `remix test` filters and the frozen-export mock seam
- `remix3-bun-runtime` — running the app or `remix test` under Bun, where the `node-tsx` loader and `@types/bun` interact
- `remix-upstream-dependency-analysis` — validating the version-pinned `remix.json`/asset-server milestones recorded in these references
