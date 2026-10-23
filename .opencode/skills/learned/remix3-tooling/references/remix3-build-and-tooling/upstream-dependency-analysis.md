# Upstream Dependency Change Impact Analysis

**Source:** `remix-upstream-dependency-analysis`

**Extracted:** 2026-07-10
**Re-validated:** 2026-10-16 (vendor facts below re-checked against the installed tree at unified build `7f900151` / source `b65325d`; versions still `remix 3.0.0` / `component 1.0.0` / `component-hmr 1.0.0` / `ui 0.12.1` — the `3.1.0` / `1.1.0` / `0.13.0` release remains staged via changesets, not yet installed; the previously staged #11978 release never landed on `preview/main` either)
**Context:** A project pins a dependency via `github:owner/repo#branch&path:subdir` (or similar) and upstream commits land on that branch. Need to determine whether updating the dependency would break the project.

## Problem

When a dependency is pinned to a GitHub branch (e.g. `"remix": "github:remix-run/remix#preview/main&path:packages/remix"`), upstream changes are opaque — `npm update` or `pnpm update` fetches whatever is at the branch tip. You need to know:

- What commits landed upstream
- Whether any of them change APIs your project uses
- Whether updating would introduce breakage

## Solution

Trace the chain from upstream changes to project impact:

1. **Find the pinned commit** in the lockfile (e.g. `pnpm-lock.yaml` contains the resolved commit hash: `version: https://codeload.github.com/.../<commit_hash>#path:...`)

2. **Fetch upstream changes** and compare:
   ```bash
   git fetch upstream-branch
   git log <pinned-commit>..origin/<branch>
   ```

3. **Diff the relevant source** between pinned and latest:
   ```bash
   git diff --stat <pinned-commit>..<latest-commit> -- packages/<dep>/
   ```

4. **Check each changed API** against your codebase:
   ```bash
   grep -r "affectedApi|changedFunction" app/
   ```

4b. **Audit code that shadows a changed vendor default.** If the app replaces a default the changed package exports (`run({ resolveFrame })` shadows `defaultResolveFrame`), the upstream fix never reaches it — diff the override against the new default and port the change. #11938 changed `getRequestBody` in `packages/component/src/runtime/run.ts` and `packages/spa/src/lib/spa.ts`; `app/assets/frame-response.browser.tsx` had to be re-synced by hand.

5. **Verify with typecheck + tests:**
   ```bash
   npm run typecheck
   npm test
   ```

**Blame triage:** before blaming a bump for a failing test, diff the *runner* between pins
(`git diff --stat <old> <new> -- packages/test packages/cli`). If that subsystem is unchanged,
the regression is app-side — the `document.dispatchEvent` failure here predated the bump.

Key focus areas when reviewing diffs:
- **New opaque types** — classes hiding previously public internals (e.g. `RoutePattern` making `.pathname` opaque)
- **Changed default behavior** — cookie codecs, encoding, serialization
- **New runtime validation** — a helper that now throws on invalid input can turn an existing unchecked `as` cast at a boundary into a 500; audit the cast adapters that feed it before updating (see `typescript-gotchas` → `references/vendor-validator-cast-audit.md`)
- **New features** — generally safe but may need opt-in adoption
- **Renamed exports** — look for `renamed|moved|deleted` in changelogs

## When to Use

- A project depends on a library via `github:owner/repo#branch&path:subdir`
- Upstream commits have landed on that branch
- Before running `pnpm update <dep>` or `npm update <dep>`
- When debugging regressions after a dependency update

## Version Lines After the Component/UI Split (#11948)

As of 2026-10-15 the repo still carries **three independent version lines**, so a single "remix version" no longer describes the dependency set. The app's branch pin (`preview/main`) resolves to the generated installable-build commit `48b54a55` (built from `aa2efcd`, i.e. `2c9e033` plus #11987/#11992/#11999), where `remix` has crossed to **stable `3.0.0`** and `@remix-run/component` / `-hmr` to **`1.0.0`**:

| package | version | notes |
| --- | --- | --- |
| `remix` | `3.0.0` | stable released; the prerelease-counter caveat no longer applies |
| `@remix-run/component` | `1.0.0` | runtime; aliased as `remix/component*` (crossed `0.x` → `1.0` since rc.5) |
| `@remix-run/component-hmr` | `1.0.0` | aliased as `remix/component-hmr*` (crossed `0.x` → `1.0`) |
| `@remix-run/ui` | `0.12.1` | primitives + animation; **not** aliased into `remix`, must be a direct dependency; still `0.x` |

Prior state (for git archaeology): at the `Release v3.0.0-rc.5` commit (`dba1546a0`; tag `remix@3.0.0-rc.5`) a `preview/main` install resolved to the generated installable-build commit `be58f7beb` (built from `904eb5ff3`) — `remix 3.0.0-rc.5` / `component 0.8.0` / `component-hmr 0.1.0` / `ui 0.12.0`.

`3.0.0-rc.4` with `ui 0.11.0` / `component 0.7.0` / `component-hmr 0.0.0` is the pre-release state at the split commit itself (`7513dae`).

**Bump recorded 2026-10-14: build `c1787ef`/source `7d5a2f9` → `c93cec30`/`e5ed055` (PR #11986 "Clean up UI APIs after styled component removal").** Range touches **only `packages/ui`**; `@remix-run/component`, `-hmr`, `assets`, the `remix` CLI, and the guides are byte-identical to the prior pin. API deltas (all verified live in the installed `.pnpm/@remix-run+ui@…c93cec30…/src/` tree):

- `@remix-run/ui/toggle` export renamed: `toggle.control` is gone → flat `toggle` export, callable directly as `toggle()` (`src/toggle.ts:186` `export const toggle = toggleMixin`). Option type `ToggleControlOptions` → `ToggleOptions`.
- Removed the always-empty styled prop types: `AccordionProps`/`AccordionItemProps`/`AccordionTriggerProps`/`AccordionContentProps`, `SelectProps`/`SelectOptionProps` (unless aliased via closing div param), `ComboboxProps`/`ComboboxOptionProps`, and the empty `TabsRootOptions`/`TabListOptions` metadata objects. Composition now = `Context` props + per-mixin `*Options` types + app-owned `Props<'div'>`/`Props<'button'>`.
- Accordion `headingLevel` prop, its context fields, and `AccordionHeadingLevel` were deleted entirely (`src/accordion.tsx`); the README now instructs an app-owned heading element (`<h2>`-style wrapper around the `trigger()` button) inside the accordion trigger markup.
- Also removed internal unexported namespace objects left over from the styled-removal series in `combobox.tsx`, `select.tsx`, `menu.tsx`.

App-side clearance at this bump (recorded so the next styled-removal-series bump has a baseline): the app imports only `@remix-run/ui/animation` (untouched) and `@remix-run/ui/menu` (unexported-namespace deletion only); grep found zero usage of any removed API; `npm run typecheck` clean; full browser suite green (mod a known timing flake in the lists autosave undo selection test). `remix test --only` scoped to that test and a full `npm run test:browser` rerun both pass at the new pin.

**Bump recorded 2026-10-14 (second, same day): build `c93cec30`/source `e5ed055` → `2c9e033`/source `e6a63ea` (#11988 `unsafeHTML()` prop diagnostics, #11989 traverse scroll/focus, #11990 component/testing docs).** Range touches `packages/component` runtime (`navigation.ts`, `unsafe-html.ts`), the vendor `remix` skill, component/test READMEs and package descriptions, `packages/remix/INDEX.md` + guides, and tests/demos; `packages/ui` and the other packages are byte-identical to the prior pin. API deltas (verified in the installed `.pnpm/@remix-run+component@…2c9e033…/` tree):

- `unsafe-html.ts` only rewords the thrown invariants — `innerHTML`/`srcDoc`/`srcdoc` now say "expected a value created with unsafeHTML()" and `outerHTML` says it is "not supported on host elements". No new validation; app already wraps at `app/ui/theme/runtime.ts`.
- `navigation.ts` `startNavigationListenerImpl`: on `traverse` (back/forward) `scroll` and `focusReset` are forced to `'after-transition'`, ignoring stored `manual`/legacy-boolean settings (previously `resetScroll: false` survived traversal). The app sets no `data-rmx-reset-scroll` and only `data-rmx-reset-focus="manual"` on the lists search form; those submits are pushes and `lists-search.tsx` refocuses on mount for back/forward, so no source change was required.
- No changed/renamed exports and no new opaque types; `@remix-run/ui` is untouched.

App-side clearance: the lock resolves both `path:` entries to the single `2c9e033` tarball; `npm run typecheck` clean; server/browser/e2e suites green (recorded 2026-10-14). The unrelated `oxlint`/`@oxlint/plugins` `1.87 → 1.88` float that `pnpm update` also produced is not part of this range.

**Bump recorded 2026-10-15: mixed prior lock (top-level `2c9e033`/source `e6a63ea`; transitive `@remix-run/*` `c7a4572`/source `22e176d`) → unified build `48b54a55`/source `aa2efcd` (#11987 detached form submitter, #11992 HMR test flake, #11999 derive AppContext from the router).**

- `pnpm update remix @remix-run/ui` re-resolved **both** top-level `path:` entries **and** every transitive `@remix-run/*` package to `48b54a55`, so the lock is now consistent (it was not before — see the branch-pin race below). A recursive diff of the installed trees `.pnpm/@remix-run+component@…c7a4572…` vs `…48b54a55…` shows the **only** changed source file in `packages/component` is `src/runtime/form-navigation.ts`; `packages/test` is byte-identical (only its `node_modules/.bin/playwright` link moved to 1.64.1).
- #11987 (`createFormNavigationResolver`): pending submissions are now indexed by **both** form and submitter (`WeakMap<HTMLFormElement | SubmitterElement, PendingFormSubmission>`), so a submit button detached before the `navigate` event still resolves its form, method/encType (`formmethod`/`formenctype`) and `data-rmx-target`; the native POST `FormData` is preserved across later `FormData` snapshots; a later canceled/duplicate submit (same or another form) can no longer replace the pending navigation. Adds a `form` field + `clearPending()`; no exported API change. Relevant to app forms that remove/re-render their submitter on submit (`admin-uploads-dropzone`, SSE approval `formaction` buttons), but no app source change was required. **Firefox caveat (verified 2026-10-15):** the fix is Chromium-only on this build — Firefox fires the native `formdata` at `eventPhase === AT_TARGET`, so the `onFormData` guard discards it and a detached submitter still full-navigates; see `remix3-frame-cliententry` → `references/frame-navigation.md` and the new `app/actions/admin/frame-form-detached-submitter.test.e2e.ts` guard.
- #11999 (template + guides + `packages/fetch-router` README; **no runtime source**): new apps use `export const router = createRouter({…})` + `export type AppContext = RouterContext<typeof router>` instead of `createRouter<AppContext>()` / `MiddlewareContext<[typeof renderMiddleware]>`, because the explicit type argument disabled middleware inference (a later-added `formData()` did not appear on `context`). This app already avoids the pitfall — `app/types/context.ts` derives `AppContext` from `ReturnType<typeof createNewappMiddleware>` and `app/router.ts` passes no explicit type argument — so no migration was required.
- #11992 is a Windows-only timing fix in `packages/component-hmr/test/hmr.test.e2e.tsx`; no runtime change.
- Versions unchanged: `remix` `3.0.0`, `@remix-run/ui` `0.12.1`, `@remix-run/component`/`-hmr` `1.0.0`. The guides anchor moves to `48b54a55` (see `docs/guide-skill-coverage.md`).
- Unrelated floats from the same `pnpm update`: `playwright` `^1.64.0` → `^1.64.1` (direct) and transitive `chat` `4.41.1`→`4.42.0`, `posthog-node` `5.55.3`→`5.56.1`, `fast-copy` `4.1.2`→`4.2.0`, `electron-to-chromium` `1.5.453`→`1.5.456`, `undici-types` `8.11.2`→`8.12.1`.

App-side clearance (2026-10-15): `npm run typecheck` clean; full `npm run test:browser` green (47 files / 740 tests, 0 fail, 2 skipped, ~59s). The single failure first blamed on the bump — the lists autosave undo assertion (`'undo is itself a mutation'`) — is the previously recorded timing flake: three isolated reruns (chromium+firefox, 14 tests each) all pass with the undo test completing in ~1.86s against its 12s budget, and the only changed runtime file in the range (`form-navigation.ts`) is unrelated to that path.

**Bump recorded 2026-10-16: unified build `48b54a55`/source `aa2efcd` → `7f900151`/source `b65325d` (PRs #12005, #12006, #12007, #12010, #12013, #12015, #12016, #12018 — the "SSR perf wave" — and #12019 "Allow mixins to skip server rendering"; repo-process-only: #12014 worktree policy).**

- Versions unchanged at install: `remix` `3.0.0`, `@remix-run/ui` `0.12.1`, `@remix-run/component`/`-hmr` `1.0.0`. #12019 carries minor changesets for `component`/`remix` (`minor.browser-only-mixins`) and a patch for `ui`, but no release commit has landed, so the staged `3.1.0`/`1.1.0`/`0.13.0` line is still not what installs.
- #12019 is the only API surface delta: `createMixin(type)` now takes a second `MixinOptions` argument, `{ ssr: false }` marks a mixin browser-only (server skips setup *and* render; nested mixins inherit the skip; module + factory args still run server-side). New exported type `MixinOptions`. Opted-in upstream: built-in `on`/`ref` mixins, and `@remix-run/ui` `animateEntrance`/`animateLayout`, `keydown`, `outsideClick`, `typeahead`, popover animation mixins (all reindent-only besides the option flip).
- App-side clearance: the app's own mixins (`app/ui/mixins/*`, `app/ui/theme/upstream-button.ts`) are all `css()` style/attribute mixins that contribute server HTML — none qualify for `{ ssr: false }`; no app source change required. Verified FOUC risk on `animateEntrance` pages is the only manual spot-check left (admin-lists, admin-users, offerings-edit, client create/edit). Docs to consult: `packages/component/docs/mixins.md` § "Browser-only mixins".
- Internals-only in the range: `stream.ts` SSR allocation/buffer/prop-copy reductions, duplicate server component ids fix, `packages/response` doctype decodling limit, `packages/assets` script-entry/barrel caching + unchanged-module reuse after watched file changes. No app-checkable API changes.
- Guides: docs/mixins.md is new vendor reading for this app's next custom-mixin work (`mixins.md` browser-only section). `docs/guide-skill-coverage.md` anchor should move `48b54a55` → `7f900151`.

**Bump recorded 2026-10-20: unified build `7f900151`/source `b65325d` → `3bb426e354`/source `2e53e244` (#12020 "Reduce server rendering memory use", #12009 "Keep scroll anchoring disabled until after a traversal paints", #12011 "Undo iOS Safari scroll restorations after a navigation resets scroll"; docs-only #11994, component-HMR test timing #11998, repo-tooling #12052).**

- Lock: all 268 `codeload.github.com/remix-run/remix/tar.gz/…` refs — both top-level `path:` entries and every transitive `@remix-run/*` package — resolve to `3bb426e354`, so the set is unified (no branch-pin race this time). Versions are unchanged (`remix` `3.0.0`, `@remix-run/ui` `0.12.1`, `@remix-run/component`/`-hmr` `1.0.0`): release PR #11978 "Release v3.1.0" (remix 3.1.0 / component 1.1.0 / ui 0.13.0) was refreshed at 2026-10-20 16:42Z but is still open, so those versions do not install from the pin.
- Runtime delta in the range is only two files: `packages/component/src/runtime/navigation.ts` — the WebKit workaround now records the positions iOS Safari restores and undoes them on `scroll` until the transition finishes or 500 ms pass, stopping on `pointerdown`/`wheel`/`keydown`/the next `navigate`; #12009 keeps scroll anchoring disabled until the first paint after a traversal. `packages/component/src/server/stream.ts` — SSR memory reduction (single join, serialized hydration props, abort-listener cleanup). `grep '^[+-]export '` over the diff is empty: no exported API or type change. `packages/ui` and `packages/remix` are byte-identical, so the staged ui 0.13.0 breaking changes (toggle rename, removed styled prop types) still do not affect this app's `@remix-run/ui/menu` + `/animation` imports.
- App-side clearance: the app-owned `app/ui/page-scroll-reset.browser.tsx` resets nested `[data-page-scroller]`/`[data-grid-scroll]` containers, while the new WebKit undo loop only touches window scroll, so they do not fight; the `scroll-restoration` e2e repro (the exact traversal-shrink case #12009 fixes) and `admin-grid-scroll` remain the guards. Typecheck and the test suites were reported green by the operator on 2026-10-20.
- Nothing app-side for #12052: it moves `static-middleware` and `multiple-import-maps-polyfill` back to `typescript: catalog:`/`tsc` and drops `@typescript/native-preview`; this app already typechecks with `tsc` (`typescript@7.0.2`) and has no `tsgo`.
- Unrelated floats from the same `pnpm update`: `nodemailer` `^10.1.2` → `^10.1.7`, `oxlint`/`@oxlint/plugins` `^1.88.0` → `^1.89.0`. `.agents/skills/remix` is a tracked symlink into the installed `@remix-run/cli` template, so it repoints into the new build directory and belongs in the bump commit.
- Learned-skill pin strings still name `7f900151`; only `packages/component` changed in this range, so their vendor facts (data-schema, UI primitives, client-entry behavior) remain valid — revisit them only when those packages move.

**Bump recorded 2026-10-20 (second, same day): unified build `3bb426e354`/source `2e53e244` → `9b5b702b1b`/source `af3ea2c` (#11993 "Add Remix UI docs site").**

- The docs site (`docs/ui/**`), publish workflow/script changes, and the `write-ui-examples`/`make-demo` skill docs are repo-only and do not ship in `packages/remix` or `packages/ui`. The only package delta is `packages/ui`: a new `prefersReducedMotion()` export from `@remix-run/ui/animation` (`src/animation/prefers-reduced-motion.ts`, wired in `src/animation.ts`), its README + tests, and a minor changeset the regenerated release PR folds into the existing ui 0.13.0 entry. Existing animation mixins do **not** consult the preference automatically, so no behavior changes.
- Versions unchanged (`remix` `3.0.0`, `@remix-run/ui` `0.12.1`, `@remix-run/component`/`-hmr` `1.0.0`); release PR #11978 was regenerated on `af3ea2c` (2026-10-20 19:20Z) but is still open, and `preview/main` is `9b5b702b1b`.
- Lock: all 268 tarball refs resolve to `9b5b702b1b`; no `package.json` floats this time — only the `.agents/skills/remix` symlink repointed into the new CLI build.
- App-side clearance: no source change. The app already implements the same behavior locally — `app/utils/motion.ts` (`prefersReducedMotion()` feeding `entrance()`/`exit()`, 21 call sites across 15 files), the shell-level `@media (prefers-reduced-motion: reduce)` guard in `app/ui/document.tsx`, and `app/assets/error-card.test.browser.tsx` asserting `entrance()` collapses under reduced motion. The vendor helper matches the local one (including the SSR `false` fallback). Dedupe landed after the bump: `app/utils/motion.ts` now re-exports the vendor helper and keeps only the `entrance()`/`exit()` wrappers; its reduced-motion browser tests (error-card, message-expand, appointment-grid) were re-run green.
- Typecheck and the test suites were reported green by the operator on 2026-10-20.

**Bump recorded 2026-10-22: unified build `9b5b702b1b`/source `af3ea2c` → `060b32a`/source `56f1fb6` (#12004 "Prefetch destination HTML and assets", #12061 "Fix missing default exports in the remix umbrella package", #12067 "Preserve fragments and keys in client entry props"; repo/docs-only: #12063 docs-dev-server HMR, #12057 root `AGENTS.md`).**

- Lock: all 268 tarball refs resolve to `060b32a`; versions unchanged (`remix` 3.0.0, `@remix-run/ui` 0.12.1, `@remix-run/component`/`-hmr` 1.0.0), so the staged 3.1.0/1.1.0/0.13.0 release (PR #11978) still does not install. `packages/ui`, `component-hmr` and `test` are byte-identical; the package delta is `packages/component` (`runtime/prefetch*.ts`, `frame.ts`, `navigation.ts`, `run.ts`, `dom.ts`, `index.ts`, `server/stream.ts`), generated `packages/remix/src/{assert,headers}.ts`, and guide/README changes. `.agents/skills/remix` repointed into the new CLI build.
- #12004 is opt-in: `data-rmx-prefetch="intent|viewport"` on anchors, imperative `prefetch(src, { target? })` from `remix/component`, and a new `run({ prefetch })` hook with `PrefetchFrame`/`PrefetchOptions`. The default fetches destination HTML with `Accept: text/html`, `X-Remix-Frame: true` (plus `X-Remix-Target` for named frames), discovers JS/CSS/explicit image+font preloads into `<link rel="prefetch">` hints, honors Save-Data and skips `slow-2g`/`2g`, dedupes in-flight work, and keeps no completed-response cache. It installs listeners plus an `IntersectionObserver`/`MutationObserver` on every run but makes no requests without marked links; pending prefetch hint links are preserved across frame head swaps.
- App-side clearance for #12004: no `data-rmx-prefetch`/`prefetch()` usage repo-wide and no `run({ prefetch })`; the custom `resolveFrame` in `app/assets/entry.tsx` is untouched. Adopting in-memory HTML reuse later needs a custom `prefetch` hook, because the default prefetcher bypasses `resolveFrameResponse`.
- Prefetch adoption decision (2026-10-22): **not adopted** for navigation links. The default prefetcher's HTML cannot be reused by this app: frame fragments are `no-store` (`app/utils/fragment-response.ts`) and `resolveFrameResponse` fetches with `cache: 'no-store'` plus a one-shot `X-Agent-Prefill` (`app/assets/frame-response.browser.tsx`), so the prefetched document is discarded and only its JS/CSS `<link rel="prefetch">` hints warm. That trades a duplicate SSR (including its DB work) per hovered link for a marginal asset head start. In-memory HTML reuse would need a custom `run({ prefetch })` plus a matching `resolveFrame` cache with TTL/mutation invalidation, prefill ordering, and fresh CSP nonces. Revisit only with a measured navigation-latency win.
- Post-refactor verification (2026-10-22, tree `35ad68c`): full `npm test` green — server + browser + e2e (62/62, 284s), closing the gap left by the final `doDecide` adapter refactor.
- #12061 restores default exports on generated `remix/*` entrypoints — `remix/assert` (callable assert helper) and `remix/headers` (`SuperHeaders`). Additive; the app imports `* as assert` and named `SuperHeaders`, so no source change.
- #12067 fixes `clientEntry` props containing JSX fragments (they serialized as `null` and disappeared when the entry re-rendered on the client) and preserves string/number keys. The app's only node-valued `clientEntry` props are `LazyFrame`'s `children`/`fallback`, always passed as plain strings; the `css()`-mixin serialization constraint in `app/ui/lazy-frame.browser.tsx` still applies.
- #12004 also changed the vendor guides: §05 gained "Prefetch links before navigation", §06 points at it, and `packages/component/docs/frames.md` gained "Prefetching" (plus `decisions/007-frame-prefetch-assets.md` in the repo). The `docs/guide-skill-coverage.md` anchor moves to `060b32a` and the prefetch chapter is recorded as a coverage gap.
- Learned-delta line refs refreshed for this build: `frame.ts` +8 (reload events, `hydrateContainer`), `stream.ts` +10 (unsafe-HTML normalization, script rendering, `resolveDefaultClientEntry`), `dom.ts` `data-rmx-target` 2308→2310, `navigation.ts` document/attribute reads 587/603→631/647. Updated `cliententry-lifecycle.md`, `frame-layout-and-testing.md`, `unsafe-html.md`, `csp-inline-scripts.md`, `client-entry-factory-extraction.md` and `attribute-renames-runtime-verification.md`.
- Unrelated floats in the same update: `@mastra/*` 1.78.0 → 1.79.0 (plus `@ai-sdk/*` transitive). Mastra 1.79 broke three app typechecks, all fixed: `DecisionModelV4CallOptions.state` became a `DecisionModelV4State` parts array, so `evaluation-model.ts` unwraps a single `text`/`json` part before prompting and the direct `doEvaluate` test passes parts; `RefusalAnswer` made classifier `choice`/`score`/`probability` optional, so `workflow-classifier.ts` maps a refusal to `unclear` and `blocksMutation` now accepts `string | undefined` (a refusal fails the processor gate open, with a unit test). Adapter/classifier calls migrated to `doDecide`/`decide` (the interface's legacy `doEvaluate` stays as an alias). Full `npm test` green (server, browser, e2e; e2e 62/62), Mastra slice 72/72, `npm run typecheck` clean.

**Bump recorded 2026-10-23: unified build `060b32a`/source `56f1fb6` → `db58e1d9`/source `32794c0` (#12002, #12025, #12027, #12040, #12043, #12045, #12046, #12048 headers/response hardening; #12041 tar-parser end marker; demo-only #12069).**

- Lock: all 268 tarball refs resolve to `db58e1d9`; versions unchanged (`remix` 3.0.0, `@remix-run/ui` 0.12.1, `@remix-run/component`/`-hmr` 1.0.0, `headers`/`response`/`tar-parser` 1.0.0), so release PR #11978 (3.1.0/1.1.0/0.13.0) still does not install.
- Package delta: `packages/headers` (`param-values.ts`, `range.ts`, `raw-headers.ts`, `if-none-match.ts`, `super-headers.ts`, `content-range.ts`), `packages/response/src/lib/file.ts`, and `packages/tar-parser/src/lib/tar.ts`. `packages/component`, `packages/ui`, and `packages/remix` source are byte-identical; `packages/assets` changes only its test. Every library commit carries a patch changeset.
- App-reachable paths: #12048 covers the asset server (`app/assets.ts` → `createAssetServer`; `IfNoneMatch.matches()`, weak `W/"<hash>"` ETags) **and** `createFileResponse` for static `public/` files via `staticFiles('./public')` in `app/middleware/root.ts`; weak comparison now lets a strong validator match, yielding RFC-correct 304s on both. #12025/#12043/#12045 also reach the static font responses: valid `206`, ignored non-byte units, and `416` for empty suffix ranges. Regression tests cover the asset-server ETag path (`app/assets.test.ts`) and static font Range/ETag behavior (`app/actions/home/controller.test.ts`). No app source change.
- #12002 changes `ContentDisposition` quoting (quotes/backslashes); app attachment filenames are static or reject `\` at `app/utils/upload-validation.ts:69`, so output is unchanged. #12027/#12040 touch raw-header/`Content-Range` parsing the app does not use (the static `Content-Range` values it emits are valid). #12046 changes numeric `SuperHeaders` reads from `NaN` to `null`; the app only writes `contentLength`. #12041 affects `tar-parser`, unused at runtime. #12069 is demo-test-only.
- `.agents/skills/remix` repointed into the `db58e1d9` CLI build (template content is byte-identical to `060b32a`); `docs/guide-skill-coverage.md` anchor moves to `db58e1d9`/`32794c0`; `AGENTS.md` current pin updated. Component/UI line refs stay at `060b32a` because those packages did not move.
- Typecheck and the full test suite were reported green by the operator on 2026-10-23 after the lock update.
- Upstream had already advanced to build `8ca388f8`/source `47a4713` at record time (#12023 normalized satisfiable ranges, #12049 If-Range validator classification, repo-only #12071 changelog tooling, and the generated `packages/remix/src/headers/README.md` copy); later `58f7f2eb`/`0a8e63e` adds only the docs-site styling change (#12032). #12023/#12049 would reach the static font path if the pin moves; `db58e1d9` remains the verified pin.

**Branch-pin transitive race (why the prior lock was mixed).** A `github:…#branch&path:…` specifier is not one resolution: `pnpm` resolves the top-level `path:` entries and the transitive `@remix-run/*` packages independently, and a later install can re-resolve the transitive set to the then-current branch tip. Before this bump the lock's two top-level entries were `2c9e033` while all ~260 transitive entries were `c7a4572` (a build published between installs), so the app was already running a *newer* `@remix-run/component` than the top-level pin suggested. When auditing a branch-pinned dependency, inspect the **installed** transitive build (`.pnpm/@remix-run+component@*`), not just the importer's lock line, and prefer a full `pnpm update` to unify the set.

**Release-day `package.json` pair.** Only two top-level entries are needed — `remix` and `@remix-run/ui`. Do not declare `@remix-run/component`(-hmr) directly; they arrive transitively and dedupe to one copy:

```jsonc
"remix": "^3.0.0",          // stable 3.0.0 released 2026-10; no -rc suffix needed
"@remix-run/ui": "^0.12.0"  // 0.12.1 lands under this caret (patch within the minor)
```

**`0.x` caret caveat.** On a `0.x` package, `^0.12.0` means `>=0.12.0 <0.13.0` — it locks the minor and allows only patches. That is the correct pin: a `0.x` minor can be breaking (0.11 -> 0.12 deleted the styled `button`/`breadcrumbs`/`checkbox`/`input`/`radio` modules plus the package-root runtime and JSX exports). Do not widen it to `>=0.12.0`.

**Git-spec equivalent.** If the app keeps `github:` specs instead of npm versions there is no number to write — pin **both** `path:` entries to the same ref/SHA so only one `@remix-run/component` resolves:

```jsonc
"remix":         "github:remix-run/remix#<ref-or-sha>&path:packages/remix",
"@remix-run/ui": "github:remix-run/remix#<ref-or-sha>&path:packages/ui"
```

