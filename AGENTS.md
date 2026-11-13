# Testapp Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

## Commands

```sh
npm i
npm run start
npm test
npm run test:coverage
npm run test:webkit
npm run typecheck
npm run format
npm run format:fix
npm run knip
npm run update:remix
npm run dev:mastra
```

This App uses Remix 3, no REACT

at .opencode/skills/ are skills for Remix 3 development

## Working Sessions

Load the `agent-ops` skill (§ Checkpoint Handoff) before winding down a session, when context is already high, or when an unrelated request arrives mid-task — it defines this workspace's checkpoint, artifact-isolation, and follow-up-prompt rules.

## Remix Source References

When you need API docs or usage examples for a `remix/*` subpath:

- Package READMEs: `node_modules/remix/src/<package>/README.md` (installed vendor docs)
- Vendor `remix` skill: `.agents/skills/remix/SKILL.md` (a single flat file — the installed build ships no `references/` directory). Drill into `node_modules/remix/INDEX.md` and the matching package README for API detail.
- Installed package source (for version-pinned line refs): `node_modules/.pnpm/@remix-run+<pkg>@*/node_modules/@remix-run/<pkg>/src/...`
- **Installed versions and pin:** `remix` 3.2.0, `@remix-run/ui` 0.13.1, `@remix-run/component` 1.2.0, `@remix-run/component-hmr` 1.0.1. Since the 2026-11-04 migration the pin is the `remix-run/previews` release `v0.20261113.33720-main-5af14d52` (source `5af14d52`), installed from its `remix.tgz`/`ui.tgz` assets — not a `github:…#preview/main&path:` or `t/<sha>/` build. #12174 replaced the `preview/main` retained-tarball branch with one GitHub release per `main` commit, so the two asset URLs in `package.json` and the 278-ref unified lock are the pin; main preview releases are pruned after ~7 days (the newest is kept).
- **Current bump (`72a7ad0f` → `5af14d52`):** #12225 adds `t.mock.property()`/`t.mock.getter()`/`t.mock.setter()` to `remix/test`; #12290 makes the component-HMR setup transform rewrite references inside nested functions against all setup variables, so the old declare-state-above-forward-call workaround is no longer required (immediate setup statements still only see initialized state); #12296 fixes the asset server's barrel optimizer so execution-order imports no longer re-add a whole barrel that a nested import bypassed. Versions stay `remix` 3.2.0, `@remix-run/component` 1.2.0, `@remix-run/component-hmr` 1.0.1 and `@remix-run/ui` 0.13.1 (`@remix-run/test` 1.1.0, `assets` 1.0.2), the guides are unchanged, and no production source change was required. The app's `lists-client.tsx` forward declarations/reordering are now redundant but harmless; `t.waitFor()` is still not adopted.
- **Previous bumps:** `17a9e392` → `72a7ad0f` was #12224 (`t.waitFor()`), #12248 (navigation coordinator), #12229 (built-in `<Frame loading="lazy">`, adopted for the dashboard's recent-activity user-detail frames) and #12288/#12289 (frame load state); `d4a24d56` → `17a9e392` added viewport prefetch scroll-settle/hidden-tab behavior and adopted `data-rmx-prefetch="viewport"` for every admin/client grid pager's prev/next; `0cab1903` → `d4a24d56` was #12274 (frame `src`/reload pairing, Safari traversal scroll), #12281 (reload transition + shared form encoding), #12276 (`data-table` SQL clause compilers), #12282 (CSS `@import` error code) and #12198 (`node-hmr` hardening); `3273a048` → `0cab1903` was #12271/#12273 `Vary` spelling/`*`, #12237 case-insensitive `CacheControl`, #12203 fake `Date`/`performance.now()`; `cc53667f` → `3273a048` was #12153 (`render()` awaits the shell chunk), #12190 (HEAD-body strip, abandoned-response cancel) and #12084 (`ui` toast, unused — the app keeps `app/ui/toast.ts`); `d488afb4` → `cc53667f` was #12255 + test-only #12257 (explicit component runtime state, no export change).
- **Guides and history:** guides last changed at `3273a048` (ch. 12's one-sentence `render()` rejection note); all other chapters are still `ca504176`'s and newer installs left all 15 files byte-identical. Per-bump PR ranges, runtime deltas, app-clearance notes and verification: `docs/remix-pin-history.md` (method: `.opencode/skills/learned/remix3-tooling/references/remix3-build-and-tooling/upstream-dependency-analysis.md`).

Do not reference `~/remix` (a separate vendor checkout) — the installed `node_modules/remix` / `node_modules/.pnpm/@remix-run+<pkg>@*/` tree and the in-project vendor skills are authoritative.

## Browser Support Floor

- **Floor: Chrome/Edge 126+ and Safari/iOS 18.2+.** `app/assets.ts` targets `chrome: '126'`, `safari: '18.2'`, `es: '2022'`. Two features used without a fallback set that floor: `spring()` emits CSS `linear(...)` easing (Safari 17.2+), and cross-document View Transitions require Chrome 126 / Safari 18.2. Do not lower the target without adding a non-`linear()` spring fallback and accepting that the shell's `@view-transition` opt-in is ignored.
- **Firefox is supported with graceful degradation.** Playwright Firefox runs in the browser and e2e suites, but Firefox does not (as of 2026-11) run cross-document View Transitions: it ignores `@view-transition` and navigates normally. Same-document transitions are feature-checked before use.
- **WebKit coverage is opt-in.** `PLAYWRIGHT_WEBKIT=1` defines the `webkit` project; `npm run test:webkit` runs browser + e2e under it, and `.github/workflows/webkit.yml` runs the same nightly/manual. The default Chromium+Firefox run is unchanged. Playwright WebKit is **engine coverage, not the Safari app**; the floor stays Safari/iOS 18.2+. WebKit reports `link.relList.supports('prefetch') === false`, so `frame-asset-prefetch` tests assert the no-op path there. On Fedora the fallback WebKit build needs ICU 74/libjpeg 8, which are not installed; Ubuntu 24.04 CI gets them from `playwright install --with-deps webkit`.
- **View Transitions scope.** `app/ui/document.tsx` opts full documents in under `@media (prefers-reduced-motion: no-preference)`. Persistent chrome is named `app-header` (`app/ui/main-nav.tsx`) and `app-sidebar` (`app/ui/sidebar-layout.tsx`); a `view-transition-name` must be unique per document. Frames do not participate — a frame swap is not a document navigation — so only login/logout and links carrying `data-rmx-document` morph. The theme flip (`app/ui/theme-toggle.browser.tsx`) is a same-document transition with a feature check and `prefersReducedMotion()` guard.
- **Guards:** `app/ui/view-transitions.test.e2e.ts` (a real document navigation starts a transition only in Chromium/WebKit; a frame navigation never does), `app/ui/layout/nav-toggle.test.browser.tsx`, and `app/ui/theme-toggle.test.browser.tsx`.

## Building Features

Refer to `.opencode/skills/remix/SKILL.md` (plus the consolidated learned skills — `remix3-server` for controllers/routes/uploads/security, `remix3-tooling` for build/tooling, `remix3-ui` for rendering/frames/client-entries). `remix/fetch-proxy`, `remix/cookie`, `remix/middleware/render`, `remix/response/*`, and the demo apps are covered by the vendor `remix` skill and their package READMEs.

## Maintaining Learned Deltas

Only the learned skills in `.opencode/skills/learned/` are maintained by this repo — everything vendor-supplied (guides, package READMEs, the vendor `remix` skill, `@mastra/core` docs) is authoritative and read-only; learned skills should point at it, never restate it.

Learned deltas encode hard-won, often **version-pinned** facts (file/line references into the installed `@remix-run/*` packages, API behaviors, release milestones). These rot silently: the vendor code moves on while the delta stays frozen. Before relying on a learned delta, validate its version-pinned claims against the current vendor tree:

- Line/path references: confirm the referenced file still exists in the installed `@remix-run/*` packages (`node_modules/.pnpm/@remix-run+<pkg>@*/node_modules/@remix-run/<pkg>/`) or at `node_modules/remix/src/<pkg>/`, and the behavior matches the current source
- API claims: check the package README or source for the named function/operator (e.g. an `inList()` operator may now exist where a raw-SQL workaround was recorded)
- Release milestones: treat "as of beta.N" / "since vX" statements as stale unless re-confirmed against the current version

When a delta is found outdated, update the skill in place (keep the delta, correct the vendor fact) — do not delete it unless the vendor now covers the content. Highest-drift-risk sections: `remix3-data` (§ Data-Table, § Database), `remix3-server` (§ Security, § Controllers — incl. `references/remix-controllers/route-contract-and-controllers.md`), `remix3-ui` (§ Frames).

Re-audit workflow: `docs/guide-chapter-audit.md`. Per-bump pin history: `docs/remix-pin-history.md`.

### Guide ↔ skill coverage

`docs/guide-skill-coverage.md` maps every installed guide chapter to the learned skill that owns it and lists known gaps. Update it whenever a guide is added/authored/renamed, a new learned delta lands, or a learned skill is added — and re-audit the chapters it marks `unfinished` when the vendor authors them. Vendor guides remain canonical; the registry only records who points at them.

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
- Frame render errors surface through `onError` unless the request is one of upstream's own internal frame subrequests. Since remix #11941 that distinction is by **object identity** (an `internalFrameRequests` `WeakSet`), not the `X-Remix-Frame` header: browser-initiated frame requests carry the header but are reported like any other request, while internal `followFrameRedirects` subrequests stay a no-op so the error is reported once by the enclosing render. The `fallback` slot remains the in-slot visibility mechanism.
- Frame sub-requests copy all outer request headers minus hop-by-hop/`sec-fetch-*` (allowlist → denylist since #11607). App control headers like `X-Agent-Prefill` therefore reach nested SSR frame resolutions — see the note in `app/utils/agent-prefill.ts`. Cross-origin frame resolutions additionally strip cookies/credentials.
- Client-entry props are JSON-serialized. Since remix #12125 (build `57ecca4cba`) elements in `children`/`fallback` may carry `css()` mixins (including mix arrays) and hydrate; `on()`/`ref()`/custom `createMixin()` mixins still cannot cross. The former `app/ui/lazy-frame.test.browser.tsx` guard was deleted with the built-in `loading="lazy"` migration, so **no app-level test covers the serialized-prop path now**; follow constraint 5 in `.opencode/skills/learned/remix3-ui/references/remix3-frame-cliententry/cliententry-lifecycle.md`, and re-add a `renderToString()` + `run()` hydration test if a client entry again passes element props with `css()` mixins.
