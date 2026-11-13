# Upstream Dependency Change Impact Analysis

**Source:** `remix-upstream-dependency-analysis`

**Extracted:** 2026-07-10
**Re-validated:** 2026-11-12 (current pin is preview release `v0.20261113.33720-main-5af14d52` / source `5af14d52`; the retained-tarball and `github:…#preview/main&path:` flows below are historical)
**Context:** A project pins a dependency to a preview build — `remix-run/previews` release asset tarballs since #12174, retained `t/<sha>/<pkg>.tgz` tarballs since #12126, or the old `github:owner/repo#branch&path:subdir` layout — and upstream commits land. Need to determine whether updating the dependency would break the project.

## Problem

When a dependency is pinned to a GitHub branch (e.g. `"remix": "github:remix-run/remix#preview/main&path:packages/remix"`) or to preview release/tarball URLs, upstream changes are opaque — a floating `npm update`/`pnpm update` fetches the branch tip, while a release pin silently ages and its assets can be pruned. You need to know:

- What commits landed upstream
- Whether any of them change APIs your project uses
- Whether updating would introduce breakage

## Solution

Trace the chain from upstream changes to project impact:

1. **Find the pinned build** in the lockfile:
   - current release pin: `https://github.com/remix-run/previews/releases/download/<tag>/<pkg>.tgz`
   - historical retained-tarball pin: `https://raw.githubusercontent.com/remix-run/remix/preview/main/t/<source-sha-8>/<pkg>.tgz`
   - old branch pin (historical): `https://codeload.github.com/.../<build-commit>#path:...`

2. **Fetch upstream changes** and compare. For a release pin, extract the
   8-hex source suffix from the tag (the release body also links the full
   commit) and use the source commit; the GitHub commits API accepts the short
   SHA:
   ```bash
   git fetch upstream-branch
   git log <pinned-source>..origin/<branch>
   ```

3. **Diff the relevant source** between pinned and latest:
   ```bash
   git diff --stat <pinned-source>..<latest-source> -- packages/<dep>/
   ```
   For an old tarball that is no longer installed, extract it
   (`tar -xzOf <pkg>.tgz package/src/...`) or diff from a clone.

4. **Check each changed API** against your codebase:
   ```bash
   grep -r "affectedApi|changedFunction" app/
   ```

4b. **Audit code that shadows a changed vendor default.** If the app replaces a default the changed package exports (`run({ resolveFrame })` shadows `defaultResolveFrame`), the upstream fix never reaches it — diff the override against the new default and port the change. #11938 changed `getRequestBody` in `packages/component/src/runtime/run.ts` and `packages/spa/src/lib/spa.ts`; `app/assets/frame-response.browser.tsx` had to be re-synced by hand.

    Overrides can be **partial**. `run({ prefetch })` replaces only the fetch function; `startPrefetching(signal, override)` still installs the intent/viewport listeners and calls that override. That is why #12256/#12286's viewport scroll-settle and hidden-tab pause reached this app even though it shadows the default prefetcher. Map the listener/observer half separately from the overridden function. Observer behavior must be verified against the real `run()` — `render()` never boots the prefetch listeners, so it needs an e2e case (`app/actions/admin/admin-lists-prefetch.test.e2e.ts`, `app/actions/client/clients-prefetch.test.e2e.ts`).

4c. **Prefer a new vendor built-in over an app-owned workaround — but audit the gaps.** When a bump adds a first-party implementation of something the app built itself, grep production call sites before keeping the workaround. Custom options exercised only by the workaround's own tests are not requirements. Compare the remaining gaps — observer margins, event semantics, fallback requirements, named-frame behavior — migrate only the production usage, then delete the workaround and its unit/browser tests, keeping one app-level integration e2e for the wiring. This removes the old client entry/import map/serialized-props cost instead of layering two implementations.

    Example: #12229's `<Frame loading="lazy">` replaced `app/ui/lazy-frame.browser.tsx`. The custom `rootMargin`/`pauseAnimationsWhenInactive` options had no production call sites, so the 204-line entry and its 331-line browser suite were deleted; `lazy-frames.test.e2e.ts` still guards the deferral contract. Preserve app-specific traps the built-in does not encode — here `name` remains load-bearing for the sub-frame 401 path.

5. **Verify with typecheck + tests:**
   ```bash
   npm run typecheck
   npm test
   ```

**Blame triage:** before blaming a bump for a failing test, prove it — see § When a bump breaks a test.

## When a bump breaks a test {#regression-triage}

**Reproduce on both pins before reading any source.** pnpm keeps the previous pin's virtual-store tree (§"Keep the lock" in `docs/pnpm-remix-preview-installs.md`), so the old build is still on disk. Repoint the top-level `remix` link — its own `node_modules/@remix-run/*` symlinks pull in the whole old tree — rerun the failing test, then restore it:

```bash
ORIG=$(readlink node_modules/remix)
ln -sfn .pnpm/remix@<old-pin-dir>/node_modules/remix node_modules/remix
NODE_ENV=test node node_modules/remix/dist/cli-entry.js test <file> --only '<test name>'
ln -sfn "$ORIG" node_modules/remix && readlink node_modules/remix   # must be the current pin
```

Old/new flips the result → the bump introduced the change; identical on both → app-side. Restore the link before doing anything else: any test run in the window silently uses the old build, and a forgotten link makes later debugging lie.

**Pick the old pin's dir.** `ls -d node_modules/.pnpm/remix@*` prints each pin's tag prefix (long names are truncated after ~55 chars with a hash). For a package whose own dir name lost the tag (`@remix-run+component@…v0.2026111_<hash>`), resolve it through a pin's tree: `readlink -f node_modules/.pnpm/remix@<dir>/node_modules/@remix-run/component`.

**Get the commit range.** `curl -sS https://api.github.com/repos/remix-run/remix/compare/<old>...<new>` lists commits and touched files; run it in one shell call into `node -e`. The JSON exceeds the `web_fetch` 100 KB cap and comes back truncated (invalid JSON). A package whose `src`/`dist` are identical but whose `package.json` dependency URLs changed has no source delta — don't report it as touched.

**Diff the installed trees without erasing the result.** Every `diff -rq` line contains `/node_modules/`, so `diff -rq … | grep -v node_modules` drops *all* of them and reads as "no diff" — in this repo it hid the `render-middleware` and `fetch-router` changes behind the #12153 regression. Use `diff -rq --exclude=node_modules <old>/src <new>/src`, or resolve both with `readlink -f` and don't filter.

**Then diff the runner:** `git diff --stat <old> <new> -- packages/test packages/cli`. If that subsystem is unchanged and both pins reproduce the failure, the regression is app-side — the `document.dispatchEvent` failure here predated the bump.

**Classify it in the pin record.** A patch changeset plus README/guide wording is still a compatibility change for apps that relied on timing: #12153 makes `render()` complete the shell before returning, which turned an accidental ordering (the session save cleared the flash before an inlined frame read it) into a duplicate banner. Fix the implicit dependency rather than pinning back, and record old→new behavior in `docs/remix-pin-history.md` plus the owning learned delta.

Key focus areas when reviewing diffs:
- **New opaque types** — classes hiding previously public internals (e.g. `RoutePattern` making `.pathname` opaque)
- **Changed default behavior** — cookie codecs, encoding, serialization
- **New runtime validation** — a helper that now throws on invalid input can turn an existing unchecked `as` cast at a boundary into a 500; audit the cast adapters that feed it before updating (see `typescript-gotchas` → `references/vendor-validator-cast-audit.md`)
- **New features** — generally safe but may need opt-in adoption
- **Renamed exports** — look for `renamed|moved|deleted` in changelogs

## Current pin and history

Current install: `remix` 3.2.0 / `@remix-run/ui` 0.13.1 / `@remix-run/component` 1.2.0 / `component-hmr` 1.0.1 at preview release `v0.20261113.33720-main-5af14d52` (source `5af14d52`). The two `package.json` specs are the release asset URLs; the lock has 278 release tarball refs at that tag. The 2026-11-13 range is #12225 (`packages/test` adds `t.mock.property()`/`t.mock.getter()`/`t.mock.setter()`: `property()` proxies a configurable own data property and tracks accesses via `accesses`/`accessCount()`/`mockImplementationOnce(value, onAccess?)`/`resetAccesses()`/`restore()`, accessor spies preserve the paired getter/setter, and `process.env` must still be assigned directly), #12290 (`packages/component-hmr` `src/lib/transform.ts`: `rewriteReferences` now rewrites identifiers inside nested functions against all setup variables via `deferredStateNames`, so a closure may call/assign a setup `let` declared later; code that runs immediately is unchanged), and #12296 (`packages/assets` `optimize-barrel-file-imports.ts`: execution-order imports account for nested barrel rewrites, so a named import that bypassed a barrel no longer re-adds the whole barrel; confirmed triggers are `@remix-run/ui`'s `animateLayout` and standalone `onInputValidation`/`InputValidationEvent`). Only those three packages changed (plus generated READMEs/dependency URLs); `packages/component`, `packages/ui`, the CLI/template, and all 15 guides are byte-identical, so the component/UI line anchors stand. The app does not use the new mock APIs, the HMR forward-reference workaround in `lists-client.tsx` is now redundant but harmless, and the barrel fix reaches the app's `@remix-run/ui/animation` imports (`spring`, `animateEntrance`, `animateExit`, `prefersReducedMotion`). The previous 2026-11-12 (third) range is #12224 (`packages/test` gains `t.waitFor(condition, { interval, timeout })`: retries thrown/rejected assertions with real timers under fake timers, defaults 50 ms/1 s, last failure as timeout `cause`), #12248 (`component` `src/runtime/navigation.ts` +183/−71: `createNavigationCoordinator` replaces the ad-hoc history flags, preventing a stale frame reload when a `currententrychange` listener starts another navigation; reuses unrendered history slots and preserves a rendered page in history before its stream finishes), #12229 (`component` `src/runtime/frame.ts` +266/−28, `component.ts`, `src/server/stream.ts`: built-in `<Frame loading="lazy">` renders only the fallback/metadata on the server and loads near the viewport in the browser; the fallback must render an element; initial lazy loads/retries emit no `reloadStart`/`reloadComplete` pair), and #12288/#12289 (the two lazy-lifecycle follow-ups, `frame.ts` +323/−292 combined: loading ownership and explicit `transitionLoad` states; no public export change). `packages/ui` source is byte-identical (its `package.json` dependency URLs were rewritten by the tag), all 15 guides are unchanged, and `packages/remix` changes only generated READMEs/URLs. The app migrated the dashboard's recent-activity user-detail frames to built-in `<Frame loading="lazy">` and deleted the old app-owned `LazyFrame` client entry/test; that fragment is now server-only and the e2e deferral contract is unchanged. All other frames stay eager (the chatlog detail pane is driven by `handle.frames.get(name)`), the navigation coordinator needs no app change, and `t.waitFor()` is not yet adopted. Anchor shifts: `frame.ts` `transitionLoad` `762`, `startLoad` `1014`, `resolveAndRenderReload` `1023`/`onCommit` `1047`, `completeReload` `1075`/dispatch `1079`, `startInheritedReload` `1082`/dispatch `1108`, `completeInheritedReload` `1120`, `hydrateContainer` `1660`, `createSubFrames` call `1694` (def `1973`), `scheduleHydrationMarker` `1696` (def `1708`); `navigation.ts` coordinator `552`, `data-rmx-document` `960`/`967`, attribute reads `986-993` (dist `790-815`); `src/server/stream.ts` normalize call `686`, `resolveDefaultClientEntry` `1283-1311`; `dist/server/stream.js` deferred catch `1427-1431`, `renderToString` `1480-1487` (`onError` `104`, resolve throw `227` unchanged). The previous 2026-11-12 (second) range is #12256 (viewport prefetching now waits 150 ms after the last scroll, including scrolls in nested containers, then prefetches only links still in view; intent and imperative triggers keep their timing), #12286 (pending viewport prefetches pause while `document.hidden` and resume on `visibilitychange` with fresh intersection/eligibility checks; the default prefetcher waits for `requestIdleCallback` with a 1 s timeout — or `setTimeout(0)` — before parsing HTML for asset hints, and abort cancels the idle work), and a `chore: format`. Only `packages/component` `src/runtime/prefetch.ts` (+83/−12), its dist/README and the generated umbrella README changed; `packages/ui` source is byte-identical (its `package.json` dependency URLs were rewritten by the tag), all 15 guides are unchanged, and no learned line anchor points into `prefetch.ts`. The app adopted viewport prefetching for every admin/client grid pager's prev/next (lists, users, appointments, messages, offerings, offering configs, resources, uploads, webhook requests, chatlog, and the clients grid; numbered page links and filter tabs stay intent-only, and grid row links are not prefetched); its custom `run({ prefetch })` still receives viewport warms because `startPrefetching(signal, override)` starts the viewport observer, while the idle-deferred default asset discovery is bypassed by the app's own `prefetchFrameAssets()`. The previous 2026-11-12 range is #12275/#12279 (Windows CI ordering), #12198 (deterministic test waits; `node-hmr` no longer misses file changes or gets stuck after restarts and spawns a single child during shutdown; `node-fetch-server`'s listener returns its promise), #12274 (`packages/component` `src/runtime/{frame,navigation}.ts`: a visible frame keeps its content when `src` changes while nested frames/client entries settle, `reloadStart`/`reloadComplete` pair once per reload, Safari restores traversal scroll after the destination renders), #12276 (`packages/data-table*`: shared SQL clause compilers exported from `remix/data-table/sql-helpers`, MySQL upsert binds inserted values before update values), #12281 (`component` `src/runtime/{frame,run,form-navigation}.ts`: reload transition state simplified — `startReload` removed, `startReloadTransition` calls `beginReload('direct', …)`; urlencoded/text-plain body encoding shared into `form-navigation.ts`), and #12282 (`packages/assets`: a CSS `@import` path passing through a file now reports `IMPORT_RESOLUTION_FAILED` instead of raw `ENOTDIR`). `packages/ui`, `render-middleware`, `fetch-router`, and the guides are byte-identical. Anchor shifts: `frame.ts` −16 for the reload helpers (`beginReload` `753`→`737`, direct `reloadStart` `763`→`747`, ancestor `733`→`717`, `onCommit` `803`→`787`, `completeReload` `825`→`809`, `reloadComplete` `829`/`861`→`813`/`845`) and −11 after hydration (`1402`/`1436`/`1438`→`1391`/`1425`/`1427`); `navigation.ts` +17 (`data-rmx-document` `831`/`838`→`848`/`855`, attribute reads `857-864`→`874-881`, dist `692-698`→`709-715`); `node-hmr` `dist/lib/runner.js` `REMIX_NODE_HMR` `16`→`17` and `buildChildProcessEnv` `864`→`887`. `frame-failures-and-rendering.md`'s `dist/server/stream.js` refs were also re-pinned (they had drifted): `104`, `1424-1427`, `227`, `1476-1483`, `108`/`128`/`136-137`. The previous 2026-11-11 (second) range is #12271/#12273/#12237 in `packages/headers` plus #12203 in `packages/test`: `Vary` now keeps the spelling a header name was first given and serializes `*` as `*`, so `compression()`/`cors()` no longer rewrite `Vary: Cookie` to `cookie` (Safari only varies on that exact spelling) or emit `*, Accept-Encoding`; `CacheControl.from()` parses directive names case-insensitively (`No-Store`, `MAX-AGE=60`); `t.useFakeTimers()` fakes `Date`, `performance.now()`, `setImmediate`/`clearImmediate`, and `AbortSignal.timeout()` (epoch-based unless `{ now }` is passed; real timers are cleared on cancel/restore). No `component`, `ui`, `fetch-router`, or guide file moved in that range, so the existing line anchors and the `ca504176` guide anchor stood. The previous 2026-11-11 range is #12153 (+ #12190, #12084, and a `chore: format`): `render()` now completes the shell chunk before its middleware returns, so a root/blocking shell render error rejects `router.fetch()` while the server can still answer 500, and the blocking self-relay frame resolves before the session middleware saves — which duplicated the one-shot flash on a full-document GET until the document became the explicit banner owner (`remix3-ui` § session-flash-frames §1a); `remix/fetch-router` strips a HEAD fallback's body after router middleware and cancels abandoned response bodies; `@remix-run/ui` gains `toast` (unused here); guide ch. 12 gained one sentence and the other guide files are byte-identical. The previous 2026-11-10 (third) range is #12255 (+ the test-only #12257) in `packages/component`'s `src/runtime/{frame-runtime,frame,reconcile,scheduler}.ts` (+85/−98): a frame's mount state becomes a `content` union (`fallback` → `rendering` → `resolved`) with the resolution `AbortController` signal replacing the token, and the scheduler's flush/cascading flags become explicit state; no changeset, no export change. Anchor shifts: `reconcile.ts` −1 after `:125` (`parseHostProps` `369`→`368` with callers `327`/`337`→`326`/`336`, `diffVNodes` `811`→`810`, `bindNodeMixRuntime` `951`/`1132`→`950`/`1131`, `reclaimPersistedMixinNode` `1299`/`2124`→`1298`/`2123`, `updateClientEntryBoundary` `1475-1512`→`1474-1511`), `frame.ts` −5 (`hydrateContainer` `1407`→`1402`, `createSubFrames` call `1441`→`1436`, `scheduleHydrationMarker` `1443`→`1438`; the stale reload-helper refs are refreshed to `startReload` `729`, `beginReload` `753`, direct `reloadStart` dispatch `763`, ancestor path `733`; `completeReload` `825`, `reloadComplete` `829`/`861`, `onCommit` `803` unchanged); `scheduler.ts` carries no line anchors in the learned skills. The 2026-11-10 (second) range was #12244 (+ #12226, #12227, and a `chore: format`) in `packages/component` and `packages/test`: seven small runtime modules were inlined into their consumers (`document-state.ts`→`scheduler.ts`, `parse-document.ts`→`frame.ts`, `client-entry-boundary.ts`→`frame-runtime.ts`/`diff-dom.ts`, `svg-attributes.ts`→`core/attributes.ts`, `core/select.ts`→`core/props.ts`, `style/index.ts`+`style/layers.ts`→`style/stylesheet.ts`; the unused `ensure()` was deleted), so the browser loads 6 fewer modules (~3% less gzip under `run()`, ~8% for `createRoot()`-only apps) with no behavior change; `@remix-run/test` exports the `TestFn`/`TestMeta` types. Anchor shifts: `reconcile.ts` −12 (`diffVNodes` `823`→`811`, `bindNodeMixRuntime` `963`/`1144`→`951`/`1132`, `reclaimPersistedMixinNode` `1311`/`2136`→`1299`/`2124`, `updateClientEntryBoundary` `1487-1524`→`1475-1512`), `frame.ts` −3 (`reloadStart` `766`/`856`→`763`/`853`, `reloadComplete` `832`/`864`→`829`/`861`, `onCommit` `806`→`803`, hydration `1410`/`1444`/`1446`→`1407`/`1441`/`1443`), `server/stream.ts` (`normalizeUnsafeHTMLProps` `670`→`681`, `resolveDefaultClientEntry` `1261-1287`→`1278-1304`), `diff-dom.ts` (`data-rmx-preserve-dom` `38`→`74`; the HMR timestamp pattern moved here from the deleted `client-entry-boundary.ts`, `:8`→`:9`), `unsafe-html.ts` −1 (`62-95`→`61-94`), and `core/props.ts` (`patchHostProps` `57`→`56`); `core/vnode.ts`, `core/mix.ts`, `navigation.ts`, `dom.ts`, and `packages/ui` are unchanged. The earlier 2026-11-10 range was #12245 only, in `packages/component`'s `src/runtime/frame.ts`, `navigation.ts`, and `run.ts` (+ their tests): frame state (top frame + named-frame registry) is now created per `run()` runtime instead of as module globals, module-level helpers (`updateUrl()`, targeted prefetch) read the most recently started runtime through `setAppFrames()` and clear it on `dispose()`, and `startNavigationListener(signal, frames)` takes the frames handle (the test-only `startNavigationListenerImpl` is gone). `frame.ts` anchors shifted −10 lines and `navigation.ts` anchors −13 (see `remix3-ui` → `jsx-attributes.md`, `frame-navigation.md`, `cliententry-lifecycle.md`, `frame-layout-and-testing.md`); nothing else moved. The 2026-11-09 (third) range was #12240 only, in `packages/component`'s `src/runtime/navigation.ts` (+ its tests and a patch changeset): a push navigation interrupted before it renders now replaces its history entry, and `data-rmx-history="replace"` links/GET forms replace the entry through `NavigationPrecommitController` where supported.

Full per-bump records (build/source pairs, PR ranges, runtime deltas, app-clearance notes, verification) live in [`docs/remix-pin-history.md`](../../../../../../docs/remix-pin-history.md). The chapter-to-skill registry is [`docs/guide-skill-coverage.md`](../../../../../../docs/guide-skill-coverage.md). Operational pnpm recipes are in [`docs/pnpm-remix-preview-installs.md`](../../../../../../docs/pnpm-remix-preview-installs.md) (current release-asset flow); old `github:…#path:` recipes are in [`docs/history/pnpm-git-hosted-installs.md`](../../../../../../docs/history/pnpm-git-hosted-installs.md).

## Preview release assets (2026-11-04+)

Since #12174 the app pins the two tarball assets from the latest
`remix-run/previews` main release, not `t/preview.json` or
`github:…#branch&path:`. Each `main` commit gets a release tagged
`v0.<date>.<time>-main-<source-sha-8>`; every package tarball rewrites its
`@remix-run/*` dependencies to the same release's asset URLs, so the lock stays
content-addressed and one build cannot drift from another.

- Resolve the latest main release with
  `GET https://api.github.com/repos/remix-run/previews/releases/latest` (PR
  previews are prereleases and are skipped); validate the tag's 8-hex suffix and
  both asset URLs.
- Main preview releases are pruned after ~7 days (the newest is kept), so an
  old lock's release URL can 404 after retention. Refresh before then.
- The older retained-tarball flow (`preview/main` + `t/preview.json`) is frozen
  at `t/1bb19a01`; the `github:…#preview/main&path:` flow is older still and no
  longer installable because `packages/*/dist` is not committed. Both are
  historical; `scripts/update-remix.ts` migrates them in place. Its historical
  race: pnpm resolved the top-level `path:` entries and the transitive
  `@remix-run/*` paths independently, so a mixed lock could run a newer
  `component` than the top-level pin. The pin history has dated examples.

`npm run update:remix` automates the release flow: read `releases/latest`,
rewrite both specs, install, verify one release tag, frozen check, skill links,
current-pin string refresh (historical `Since …` lines skipped; `--no-docs` opts
out), typecheck/lint/format/tests, then a pin-history scaffold with parsed test
counts. `npm run remix:pin:check` verifies lock/tag
unification, HEADs the assets, and warns when the pin is not the newest main
release or is older than five days. Install retries use the universal
`--config.fetch-retries=…` / `--config.fetch-retry-*-timeout=…` form because
pnpm 12 removed the dedicated `--fetch-retries`/`--fetch-retry-*` flags.

## Preview release pair

Only two top-level entries are needed — `remix` and `@remix-run/ui`. Do not
declare `@remix-run/component`(-hmr) directly; they arrive transitively and
dedupe to one copy:

```jsonc
"remix": "https://github.com/remix-run/previews/releases/download/v0.20261113.33720-main-5af14d52/remix.tgz",
"@remix-run/ui": "https://github.com/remix-run/previews/releases/download/v0.20261113.33720-main-5af14d52/ui.tgz"
```

Both must come from the same release. Do not hand-pin one and leave the other
on an older release tag.

**Released npm versions instead.** If the app leaves the preview line for
published versions, `^3.2.0` / `^0.13.1` are the release-day pair. On a `0.x`
package, `^0.13.1` means `>=0.13.1 <0.14.0` — it locks the minor and allows only
patches, which is correct because a `0.x` minor can be breaking (0.11 -> 0.12
deleted the styled `button`/`breadcrumbs`/`checkbox`/`input`/`radio` modules plus
the package-root runtime and JSX exports; 0.12 -> 0.13 removed the styled
wrapper prop types and renamed `toggle.control` to `toggle`). Do not widen the
range across a `0.x` minor boundary.

## When to Use

- A project pins Remix previews as release asset tarballs (or, historically,
  retained `t/<sha>` tarballs / `github:owner/repo#branch&path:subdir`) and
  upstream has moved
- Before running `npm run update:remix`, `pnpm update <dep>` or `npm update <dep>`
- When debugging regressions after a dependency update
