# Testapp Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

## Commands

```sh
npm i
npm run start
npm test
npm run typecheck
npm run format
npm run format:fix
npm run dev:mastra
```

This App uses Remix 3, no REACT

at .opencode/skills/ are skills for Remix 3 development

## Remix Source References

When you need API docs or usage examples for a `remix/*` subpath:

- Package READMEs: `node_modules/remix/src/<package>/README.md` (installed vendor docs)
- Vendor `remix` skill: `.agents/skills/remix/SKILL.md` (a single flat file — the installed build ships no `references/` directory). Drill into `node_modules/remix/INDEX.md` and the matching package README for API detail.
- Installed package source (for version-pinned line refs): `node_modules/.pnpm/@remix-run+<pkg>@*/node_modules/@remix-run/<pkg>/src/...`

Do not reference `~/remix` (a separate vendor checkout) — the installed `node_modules/remix` / `node_modules/.pnpm/@remix-run+<pkg>@*/` tree and the in-project vendor skills are authoritative.

## Building Features

Refer to `.opencode/skills/remix/SKILL.md` (plus 5 specialized skills: remix3-build-and-tooling, remix-file-uploads, remix-headers, remix-html-template, security-gotchas). `remix/fetch-proxy`, `remix/cookie`, `remix/middleware/render`, `remix/response/*`, and the demo apps are covered by the vendor `remix` skill and their package READMEs.

## Maintaining Learned Deltas

Only the learned skills in `.opencode/skills/learned/` are maintained by this repo — everything vendor-supplied (guides, package READMEs, the vendor `remix` skill, `@mastra/core` docs) is authoritative and read-only; learned skills should point at it, never restate it.

Learned deltas encode hard-won, often **version-pinned** facts (file/line references into the installed `@remix-run/*` packages, API behaviors, release milestones). These rot silently: the vendor code moves on while the delta stays frozen. Before relying on a learned delta, validate its version-pinned claims against the current vendor tree:

- Line/path references: confirm the referenced file still exists in the installed `@remix-run/*` packages (`node_modules/.pnpm/@remix-run+<pkg>@*/node_modules/@remix-run/<pkg>/`) or at `node_modules/remix/src/<pkg>/`, and the behavior matches the current source
- API claims: check the package README or source for the named function/operator (e.g. an `inList()` operator may now exist where a raw-SQL workaround was recorded)
- Release milestones: treat "as of beta.N" / "since vX" statements as stale unless re-confirmed against the current version

When a delta is found outdated, update the skill in place (keep the delta, correct the vendor fact) — do not delete it unless the vendor now covers the content. Audit runbooks: `remix3-data-table`, `security-gotchas`, `remix-routepattern-opaque-access`, `remix3-frame-cliententry` are the highest-drift-risk skills.

## Starter Layout

- `app/actions/controller.tsx` is the `remix doctor` entry point for the root route map; the top-level actions (`assets`, `home`) are implemented in `app/actions/home/controller.tsx` and re-exported
- `app/routes.ts` defines the route contract
- `app/router.ts` wires routes to route handlers
- `app/middleware/root.ts` installs the conventional request-scoped renderer (`render({ assets })` from `remix/middleware/render`) used by actions
- `app/ui/` holds the shared document shell and home page UI
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and renderer
- `public/` contains static files served from the app root

## Route Ownership

- Start from `app/routes.ts` and map each route to the narrowest owner on disk.
- Give every route map a `controller.tsx` entry point at the path `remix doctor` derives from its key path: kebab-case each key segment and join with `/` under `app/actions/`. Examples: `auth.login` → `app/actions/auth/login/controller.tsx`, `apiLists` → `app/actions/api-lists/controller.tsx`, and the root map → `app/actions/controller.tsx`. A map with direct route leaves (`get`/`post`/`form`/`resources`) also needs that `controller.tsx` file.
- Keep the real implementation in the narrowest feature controller and make the entry point a thin re-export when they differ; do not move code just to satisfy the path (e.g. `app/actions/admin/support-agent/controller.tsx` re-exports the colocated top-level `app/actions/support-agent/controller.tsx`).
- Keep route-owned page modules next to the route that owns them.
- Move shared UI to `app/ui/`, not `app/actions/`.

## `remix doctor` Action Conventions

- The `actions` suite only checks that the entry-point paths above exist; it does not inspect their contents.
- Findings are warnings and exit 0, unless `--strict` or `--fix` is passed. `remix doctor --fix` only creates/updates `app/routes.ts`, so keep the entry points in sync by hand when adding or renaming route maps.
- See `node_modules/remix/guides/14-cli-and-tooling.md`.

## Build-Out Notes

- This starter intentionally begins small; add directories like `app/data/` and `test/` only when you need them.
- Prefer putting code in the narrowest owner before introducing shared modules.
- Avoid generic dumping-ground directories like `app/lib/` or `app/components/`.

## Frame Rendering Invariants (conventional `render()` middleware)

- Every blocking `<Frame>` (no `fallback` prop) must render HTML on **all** responses, including error paths — a non-HTML response fails the whole outer page render. Prefer giving frames a `fallback` so failures degrade to the slot instead.
- Frame render errors inside fragment requests (`X-Remix-Frame: true`) are silently swallowed by upstream design (`onError` is forced to a no-op); the `fallback` slot is the visibility mechanism. Top-level document render errors log via `onError`.
- Frame sub-requests copy all outer request headers minus hop-by-hop/`sec-fetch-*` (allowlist → denylist since #11607). App control headers like `X-Agent-Prefill` therefore reach nested SSR frame resolutions — see the note in `app/utils/agent-prefill.ts`. Cross-origin frame resolutions additionally strip cookies/credentials.
