# Upstream Dependency Change Impact Analysis

**Source:** `remix-upstream-dependency-analysis`

**Extracted:** 2026-07-10
**Re-validated:** 2026-11-25 (current pin is preview release `v0.0.20261125-main-d7d106ea` / source `d7d106ea`; the retained-tarball and `github:…#preview/main&path:` flows below are historical)
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

4b. **Audit code that shadows a changed vendor default.** If the app replaces a default the changed package exports (`run({ resolveFrame })` shadows `defaultResolveFrame`), the upstream fix never reaches it — diff the override against the new default and port the change. #11938 changed `getRequestBody` in `packages/component/src/runtime/run.ts` and `packages/spa/src/lib/spa.ts`; `app/assets/frame-response.browser.tsx` had to be re-synced by hand. Since #12249 the default itself is exported: prefer `defaultResolveFrame(src, options, { fetch, commit })` over copying its request/redirect/stream logic. The `fetch` callback can return a cached `Response` (the one-shot warm-cache case) and `commit` wraps rendering for view transitions; the callback is keyed by response identity, so return that response unchanged. **The app now takes this path**: `frame-response.browser.tsx` delegates request construction and keeps only the `fetch` override (`X-Agent-Prefill`, `cache: 'no-store'`) plus `classifyFrameResponse`; `frame-prefetch.browser.ts` delegates to `defaultPrefetch` and keeps only its `fetch`/`processFrame` overrides. The shadowed-default audit therefore no longer covers request encoding or prefetch parsing — re-check the **policy diffs** (`classifyFrameResponse` outcomes, prefill one-shot semantics, asset-hint rules) on a bump. A `defaultResolveFrame` rejection (5xx/non-HTML 3xx/4xx) happens *before* the app sees the response and carries only status/statusText; the app captures the response in its `fetch` override and reclassifies it. Do not parse the error message.

    Overrides can be **partial**. `run({ prefetch })` replaces only the fetch function; `startPrefetching(signal, override)` still installs the intent/viewport listeners and calls that override. That is why #12256/#12286's viewport scroll-settle and hidden-tab pause reached this app even though it shadows the default prefetcher. Map the listener/observer half separately from the overridden function. Observer behavior must be verified against the real `run()` — `render()` never boots the prefetch listeners, so it needs an e2e case (`app/actions/admin/admin-lists-prefetch.test.e2e.ts`, `app/actions/client/clients-prefetch.test.e2e.ts`).

4c. **Prefer a new vendor built-in over an app-owned workaround — but audit the gaps.** When a bump adds a first-party implementation of something the app built itself, grep production call sites before keeping the workaround. Custom options exercised only by the workaround's own tests are not requirements. Compare the remaining gaps — observer margins, event semantics, fallback requirements, named-frame behavior — migrate only the production usage, then delete the workaround and its unit/browser tests, keeping one app-level integration e2e for the wiring. This removes the old client entry/import map/serialized-props cost instead of layering two implementations.

    Example: #12229's `<Frame loading="lazy">` replaced the removed `app/ui/lazy-frame.browser.tsx`. The custom `rootMargin`/`pauseAnimationsWhenInactive` options had no production call sites, so the 204-line entry and its 331-line browser suite were deleted; `lazy-frames.test.e2e.ts` still guards the deferral contract. Preserve app-specific traps the built-in does not encode — here `name` remains load-bearing for the sub-frame 401 path.

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

Current install: `remix` 3.3.0 / `@remix-run/ui` 0.14.0 / `@remix-run/component` 1.3.0 / `component-hmr` 1.0.2 at preview release `v0.0.20261126-main-ab07c1d8` (source `ab07c1d8`). The two `package.json` specs are the release asset URLs; the lock has 278 release tarball refs at that tag.

Current pin: `d7d106ea` → `ab07c1d8` (6 commits).

Current range summary: 6 commits. #12450/#12451 rewrite `@remix-run/node-fetch-server`'s request listener and abort plumbing (single-pass parsing, fewer per-request allocations, `read-stream.ts` removed, benchmark README refresh; public request semantics unchanged). #12454 speeds up `@remix-run/component` SSR (`server/stream.ts` +647/−411, `runtime/vnode.ts`, `runtime/vdom.ts`, `style/stylesheet.ts`), #12455 preserves working components after a rejected HMR update (component-hmr browser/server runtimes and transform), and #12440 is record-store demo-test-only. #12170 adds `@remix-run/ui/dialog` (`src/dialog.ts` +673) and a shared dismissable/focus stack (`lib/{dismissable-layer,focus-boundary,focus-portal,focus-scope,finish-animations}.ts(x)`), rewrites menu/popover/select/combobox/toast around it, and adds the `dialog` package export. No version or guide changed. Consumer-breaking: `menu.popover()` throws without a matching `menu.PopoverContext`, `menu.Portal` is new, and popovers now expose `data-popover`/`data-open`/`data-state` with CSS `z-index`/`--rmx-layer-order` instead of the native Popover API (`:popover-open`, `beforetoggle`/`toggle`, `::backdrop` inert) — the app's shared `MenuList` wraps in `menu.PopoverContext` and its surface styles key on `data-state`. The previous range (`53dad21e` → `d7d106ea`, 1 commit): #12448 optimizes `@remix-run/fetch-router` static-route dispatch and `RequestContext` overhead: exact static pathname routes are indexed per method and served without `new URL()`/`MultiMatcher.match()`, `RequestContext.get`/`has`/`set` are memoized lazy accessors, and middleware/dispatch avoids unnecessary promise and rest-array allocation. Parameterized, custom, constrained, percent-encoded, and dot-segment paths keep the existing matcher. No public export, version, or guide changed; only `fetch-router` `src/lib/{router,request-context,middleware}.ts`, tests, and its README benchmark table move. The previous range (`24311e52` → `53dad21e`, 1 commit): #12447 corrects `@remix-run/fetch-router`’s async no-return abort path: when a middleware calls `next()` without awaiting or returning it and `request.signal` aborts before the middleware settles, `runMiddleware()` now waits for the downstream `nextPromise` via `settleAndCheckAbort()` instead of rejecting immediately, so `router.fetch()` and outer middleware wait for in-flight work before rejecting and a late response body is still cancelled. `throwIfRequestAborted()` now takes only a `Response`; its Promise-body cancellation helper was removed. The previous range (`8a8adc7b` → `24311e52`, 2 commits): #12443 publishes benchmark tables in package READMEs and adds `bench`/`bench:update-readme` scripts to `fetch-router`, `multipart-parser`, `route-pattern`, and `tar-parser`; no runtime source (README/bench/`package.json` only). #12446 makes `@remix-run/fetch-router` treat request aborts cooperatively (minor changeset): `router.fetch()` and `runMiddleware()` no longer race middleware/handlers against `request.signal` — `raceRequestAbort()`/`AbortRace`/`cancelAbandonedResponse()` are replaced by `throwIfRequestAborted()`/`getRejectionReason()`/`cancelUnreadResponse()` in `src/lib/request-abort.ts`. The router checks the signal before starting each layer and when work settles, rejects with the abort reason, and still cancels a late/unread response body; it no longer interrupts work already in progress. `runMiddleware()` loses its internal `sharedAbortRace` parameter (not a public export). Guide 12 §"Treat request aborts as cancellation" is the only guide change. Shipped runtime delta: `fetch-router` `src/lib/{request-abort,router,middleware}.ts` and matching `dist/lib/*` (plus README/bench scripts); `remix` changes only dependency URLs, guide 12, and the package README copies (`dist/` byte-identical); `ui` changes only dependency URLs; `multipart-parser`/`route-pattern`/`tar-parser` gain bench READMEs/scripts with no runtime `dist/` change. Versions unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2, `fetch-router` 1.0.1). The previous range (`d593e542` → `8a8adc7b`, 18 commits): the 3.4.0 release train plus the large component-runtime refactor. #12416 makes keyed single-element reorders use `moveBefore()` (fallback `insertBefore()`) so focus, iframes, animations, dialogs and popovers survive; #12429 decouples optional runtime subsystems (mixins, `on()` direct events, style/nonce managers, frame runtime, stream protocol, client entries) behind runtime hooks, unifies host reconciliation, and makes keyed diffing a fast in-order path plus single-pass LIS; #12435 co-locates core runtime modules into `runtime/vdom.ts`/`runtime/vnode.ts` (removing `runtime/reconcile.ts`, `runtime/core/props.ts`, `runtime/unsafe-html.ts`, `runtime/refresh.ts`) and scopes focus/selection/scroll restoration to actual DOM moves; #12433 + #12442 replace the SVG allowlist with a kebab-case fallback, normalize `xlinkHref`/`xlink:href` to SVG2 `href` while keeping the other `xlink:*` props namespaced, and write camelCase inline styles directly; #12426 makes `compressStream()` honor downstream backpressure and cancel cleanly after upstream EOF; #12434 rewrites fetch-router matching/context/dispatch around `resolveFromMatchAll()`/`resolveRoute()` and an `AbortRace`; #12427/#12439 simplify route-pattern tries/programs/parsers with unchanged results; #12430 fixes duplicate component-HMR setup for stateless components; #12419/#12420/#12425/#12428/#12431/#12432/#12437 are demo/test-only (bookstore → record store, catalog/tracklists, prefetch/carousel test races); #12441 is release notes/changesets. Shipped runtime delta: the component renderer/vnode/mixins/frame/style/server files, `response/lib/compress.ts`, `route-pattern` match/specificity/parse, `fetch-router` router/context/middleware/abort, and `component-hmr` browser runtime; the `remix` meta package changes only two READMEs (its `dist/` is byte-identical). Versions unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2) and all 15 guides are byte-identical. The previous range (`31805aa3` → `d593e542`, 2 commits): #12423 limits `coerce.bigint()` strings to 4,096 UTF-16 code units, rejecting longer inputs before `BigInt`; #12424 makes route-pattern `createHref()` reject pathname variable values that produce standalone `.` or `..` segments, including percent-encoded dot forms, with `invalid-pathname-variable` while dots inside larger segments remain valid. Shipped runtime delta: `data-schema/src/lib/coerce.ts` (+15/−1) and `route-pattern/src/lib/href.ts` (+111/−40), plus tests/READMEs/changesets; versions unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2) and all 15 guides are byte-identical. The previous range (`16f4e0e3` → `31805aa3`, 2 commits): #12417 moves the portal reconciler into a lazily loaded `@remix-run/component/src/runtime/portal.ts`; frame hydration detects serialized portal nodes in `rmx-data` and imports that module before hydrating, while importing `Portal` itself loads the renderer through the normal component entry. The public `Portal`/`PortalProps` surface and portal behavior are unchanged. #12422 makes `@remix-run/mime` `detectMimeType()` return `undefined` for unregistered extensions that collide with inherited object property names (`constructor`, `__proto__`) instead of returning the inherited value. Shipped runtime delta: new `component/src/runtime/portal.ts` (+241) plus moves in `index.ts`/`component.ts`/`frame.ts`/`reconcile.ts`, and one `mime/src/lib/detect-mime-type.ts` lookup; versions unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2) and all 15 guides are byte-identical. The previous range (`3f499063` → `16f4e0e3`, 3 commits): #12388 preserves named submitter data in frame POSTs by preferring the captured native `formdata` snapshot after pending UI disables or renames the button; #12415 ignores IME-composition keydowns (including Safari's `keyCode === 229` fallback) in `@remix-run/ui/combobox`; #12346 expands the bookstore demo (responsive images, prefetch sharing, optimistic cart) and is demo/test-only. Shipped runtime delta: `component/src/runtime/frame.ts` +50/−23 and `ui/src/combobox.tsx` +5; both are patch changesets, with no export/version/guide changes. The previous range (`1d817a3d` → `3f499063`, 19 commits): #12384 navigation referrer, #12385 empty-string boolean attributes, and #12344's `Portal` (additive, client-entry-only); a large internal component-runtime refactor that removes `props-serialization.ts`/`style.ts`, loads `css()` class/rule generation with `css()`, hydrates frames and client entries in one pass, preserves edits to uncontrolled inputs, and shrinks/speeds up the frame runtime (#12398/#12403/#12405/#12407–#12413); `@remix-run/ui` `anchor()` fixed-position positioning (#12396); and assets/HMR source maps + binding semantics (#12397/#12399/#12402/#12404). No export removed or renamed, versions unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2), all 15 guides byte-identical. #12395 is a docs-shell test fix and `38919028` is the build's README sync. The previous range (`20a7ad3e` → `1d817a3d`, 1 commit): one test-only commit — #12394 makes the component-HMR browser fixtures register their console listener before a reload and start the 15-second hydration timeout after the reloaded page loads (or when a deliberately held script is released), so navigation and module fetching no longer consume the deadline. No runtime source, exports, versions, or guides changed. The previous range (`d1061933` → `20a7ad3e`, 1 commit): one test-only commit — #12393 raises the `@remix-run/component-hmr` Node HMR fixture readiness timeout to 15 seconds for proxy/child startup and restarts, stops the fixture on startup failure, and tolerates a closed IPC channel during shutdown. The previous range (`b42a817e` → `d1061933`, 4 commits): four commits — #12367 changes only `@remix-run/multipart-parser` (native Bun `Buffer.indexOf`, KMP no-`Buffer` fallback, long boundary matches split across chunks) and adds Bun `>=1.4.3` engine metadata to the relevant packages; #12392 sends WebKit `Vary: *` (and other agents `Vary: User-Agent, Accept-Encoding`) on HMR-served compiled JavaScript, including 304s and excluding source maps, fixing stale preloaded modules after WebKit full-page HMR reloads; #12391 fixes intercepted Firefox form submissions to preserve form/submitter/native `FormData` after submit dispatch (`@remix-run/component/src/runtime/frame.ts` guard now checks the submit event's `currentTarget`) and expands the shared browser matrix/test runner; #12390 adds file-stat-validated per-run browser-test script caching in `@remix-run/test`, with its HMR-test split and toast fake-timer changes upstream-test-only. Versions unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2) and all 15 guides are byte-identical. The previous range (`275f353c` → `b42a817e`, 1 commit): no runtime source change — #12378 is test-only: `@remix-run/component-hmr` rewrites its transform tests to execute transformed TSX through the real browser HMR runtime (adding `oxc-transform` as a devDependency; the package was already a runtime dependency of `@remix-run/assets`), while `dist/lib/transform.js` is byte-identical and `@remix-run/test` still transforms/collects coverage with esbuild. Versions unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2) and all 15 guides are byte-identical. The previous range (`01e5b5d4` → `275f353c`, 4 commits): no component/frame/navigation change. `@remix-run/test` gives each browser test file a fresh history budget and retries a WebKit history-quota failure once after an 11-second backoff, and `RunTestsOptions` gains an optional `onHistoryQuotaExceeded` hook (#12350). `@remix-run/lazy-file` reads `LazyBlob`/`LazyFile` content via `getReader()` when `ReadableStream[Symbol.asyncIterator]` is missing (#12370). `@remix-run/ui`'s toast skips the `--toast-countdown` animation when `CSS.registerProperty` is unavailable (#12370). `@remix-run/data-schema`'s `object()`/`record()` define accepted keys as own properties, preserving `__proto__` and transformed record keys (#12373). #12371 is CI/test-only (shared Playwright configs, `scripts/test-browser.ts`, demo/docs test edits). Versions are unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2; four pending patch changesets) and all 15 guides are byte-identical. The previous range (`9e4da4d3` → `01e5b5d4`, 5 commits): only two shipped source files — `@remix-run/component/src/runtime/navigation.ts` (+72/−2, #12295 best-effort traversal scroll restoration for WebKit **and** Firefox: per-history-entry snapshots, an input-timestamp guard, restore only when `history.scrollRestoration === 'auto'`) and `@remix-run/node-fetch-server/src/lib/request-listener.ts` (+22/−6, #12368 rejects a literal backslash in the request path before WHATWG URL parsing normalizes it, via `RequestTargetError` → default 400; query and percent-encoded backslashes stay accepted). #12356/#12358/#12369 are test-only (`scripts/utils/preview.test.ts`, `docs/site/app/router.test.ts`, `packages/assets/.../asset-server.test.ts`), all 15 guides are byte-identical, and versions are unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2; two pending patch changesets). Before that, `74f06706` → `9e4da4d3` (4 commits) was #12349's PR-preview path filter, #12348's empty-string hydration ordering fix (`reconcile.ts` +9), #12352's guide-04/cookie docs, and #12355's docs-site markdown; `74f06706` was the 3.3.0 release plus the breaking data-table array/`column.json()` changes (`b4185ba2` → `74f06706`, 14 commits). The `9cbc5144` → `b4185ba2` range (3 commits) had no package source change, #12294 was the only change in `ab790c88` → `9cbc5144`, and #12314's browser-runtime fold was `9b0ff351` → `ab790c88`; earlier ranges are in `docs/remix-pin-history.md`.

**Current-range app clearance:** one small source cleanup, no behavior change. `app/ui/theme/glyph/glyph.tsx` now passes SVG2 `href` directly (instead of relying on the runtime's `xlinkHref` → `href` normalization), `app/ui/password-toggle.script.ts` no longer writes a duplicate namespaced `xlink:href`, and the `lists-polish`/`password-toggle` browser tests assert `href` and the absence of the legacy attribute. `app/middleware/root.ts`'s `compression()` inherits the #12426 backpressure fix. No app markup uses the other `xlink:*` props, and no single-element client-side DOM move needs `moveBefore()` state preservation (lists reorder through frame reloads/keyed diffing). `remix/router` matching/dispatch is exercised by the server/e2e suites, and `Portal`, client entries, frames and hydration remain covered by their existing guards (the #12417 `Portal`/`detectMimeType` clearance is unchanged). The previous range's clearance and historical notes are recorded in `docs/remix-pin-history.md`.

App state: property/accessor mocks are used in three tests; the pre-#12290 HMR forward-declaration workaround is removed; `t.waitFor()` is used across browser tests; built-in `Frame loading="lazy"` covers the dashboard cards, recent-activity details, and chatlog detail pane; grid pagers use `data-rmx-prefetch="viewport"`, admin sidebar section links use `intent`, and the `/lists` sidebar prev/next pager uses `intent` (always visible, so viewport would warm on load). **Both prefetch/resolve hooks were already adopted before this pin**: `app/assets/frame-response.browser.tsx` delegates to `defaultResolveFrame(..., { fetch, commit })` and keeps only `classifyFrameResponse` plus the request policy; `app/assets/frame-prefetch.browser.ts` delegates to `defaultPrefetch(src, options, { fetch, processFrame })`, stores a clone in the one-shot cache, and feeds the vendor's parsed assets into the app hint creator. The scoped admin-lists grid ⇄ editor frame swap uses the commit hook (`app/assets/frame-transition.browser.ts`). #12277's per-caller `options.signal` is deliberately not forwarded to the shared warm fetch: the navigation claims the response before unmounting the anchor, so aborting the fetch with the caller's signal errors the cached body mid-render (fixed after a week-nav e2e regression; see `remix3 § UI` → `frame-prefetch-cache.md`). The store is still refused when the caller aborts before the response arrives. Neither `options.navigationType`/`options.from` (nor their removed `transition` predecessor) is used for caching: fragments are `no-store` and the in-memory one-shot cache already covers the useful case, with no measured win to gate on (Task 4 decision). #12294 needs no app source change: the app's frame forms already listen for the replayed `input`/`change` phases (`app/actions/lists/public/lists-view.tsx` field handlers, `app/ui/filter-autosubmit.browser.tsx`), so a value edited before its control hydrates now reaches app state once instead of being reset; nothing depended on the old overwrite. **#12295 needs no app source change:** the vendor restore is window-level and only for `history.scrollRestoration === 'auto'`; the app's `app/ui/page-scroll-reset.browser.tsx` resets nested `[data-page-scroller]`/`[data-grid-scroll]` containers, and `app/actions/scroll-restoration/scroll-restoration.test.e2e.ts` + `scroll-anchoring.test.e2e.ts` (Chromium + Firefox) are the guards. **#12368 needs no app source change:** the app's `onError` in `server.ts`/`app/utils/server-handler.ts` still returns its own 500 page, which masks the upstream default 400 for invalid targets and authorities (same as before the bump); `getSafeReturnTo()` in `app/utils/redirect.ts` already rejects a return path starting with a backslash. **Navigation UI adoption:** `app/ui/pending-submit.browser.tsx` uses `on('rmx:navigation', …)` + `event.finished` (renamed from `rmx:submission` at #12306); `app/ui/filter-autosubmit.browser.tsx` checks `navigation.element` is its own form before remembering the filter and uses `reloadStart` metadata only for programmatic reloads. Per-bump records (PR ranges, runtime deltas, anchor shifts, verification) live in `docs/remix-pin-history.md`; line anchors live in the owning learned references.

Full per-bump records (build/source pairs, PR ranges, runtime deltas, app-clearance notes, verification) live in [`docs/remix-pin-history.md`](../../../../../../docs/remix-pin-history.md). The chapter-to-skill registry is [`docs/guide-skill-coverage.md`](../../../../../../docs/guide-skill-coverage.md). Operational pnpm recipes are in [`docs/pnpm-remix-preview-installs.md`](../../../../../../docs/pnpm-remix-preview-installs.md) (current release-asset flow); old `github:…#path:` recipes are in [`docs/history/pnpm-git-hosted-installs.md`](../../../../../../docs/history/pnpm-git-hosted-installs.md).

## Preview release assets (2026-11-04+)

Since #12174 the app pins the two tarball assets from the latest
`remix-run/previews` main release, not `t/preview.json` or
`github:…#branch&path:`. Each `main` commit gets a release tagged
`v0.0.<date>-main-<source-sha-8>` since #12319 (older builds use
`v0.<date>.<counter>-main-<sha>`; main builds used counter `0`); every package
tarball rewrites its `@remix-run/*` dependencies to the same release's asset
URLs, so the lock stays content-addressed and one build cannot drift from
another. Both tag shapes are parsed by `scripts/preview-release-tag.ts`.

- Resolve the latest main release with
  `GET https://api.github.com/repos/remix-run/previews/releases/latest` (PR
  previews are prereleases and are skipped); validate the tag's 8-hex suffix and
  both asset URLs.
- Since #12311 main preview releases are retained for 30 days (the latest
  publication is kept indefinitely), so an old lock's release URL can 404 after
  retention. Refresh before then; `remix:pin:check` warns at 25 days.
- The older retained-tarball flow (`preview/main` + `t/preview.json`) is frozen
  at `t/1bb19a01`; the `github:…#preview/main&path:` flow is older still and no
  longer installable because `packages/*/dist` is not committed. Both are
  historical; `scripts/update-remix.ts` migrates them in place. Its historical
  race: pnpm resolved the top-level `path:` entries and the transitive
  `@remix-run/*` paths independently, so a mixed lock could run a newer
  `component` than the top-level pin. The pin history has dated examples.

`npm run update:remix` automates the release flow: read `releases/latest`,
rewrite both specs, install, verify one release tag, frozen check, skill links,
current-pin string refresh (historical `Since …` lines skipped; the analysis
`Current pin` line is refreshed too; `--no-docs` opts out), analysis-doc gate,
typecheck/lint/format/tests, then the pin-history entry + newest-first table row
(editorial bullets remain TODO). `npm run remix:pin:check` verifies lock/tag
unification and the analysis `Current install`/`Current pin` lines, HEADs the
assets, and warns when the pin is not the newest main release or is older than
five days. Install retries use the universal `--config.fetch-retries=…` /
`--config.fetch-retry-*-timeout=…` form because pnpm 12 removed the dedicated
`--fetch-retries`/`--fetch-retry-*` flags.

### Bumping across a breaking change (`update:remix` is not atomic)

The script installs and refreshes docs **before** it runs the checks, so a
consumer-breaking bump stops it at `== Checks ==` with the pin already applied.
It prints the modified files, the failing step with its last 20 output lines, a
resume command, and the pin-history scaffold; `--verify` re-runs the analysis
gate plus typecheck/lint/format/tests without network or install.

- Expect the stop at `typecheck`. `package.json`, `pnpm-lock.yaml`, the skill
  symlinks, the current-pin strings, and the analysis `Current pin` line are
  already at the new tag; lint, format, tests, and the pin-history write are what
  did not run. `--no-tests` does not skip `typecheck`.
- Do not re-run `update:remix` to finish. When the tag already matches and the lock
  is unified it prints `Already up to date; nothing to do.` and returns **before**
  the checks, so it cannot rerun them.
- Fix the source, then run `npm run update:remix -- --verify` (or the individual
  checks). A successful update writes the history entry/table row; a preflight
  failure happens before install, prints the step/tail without a scaffold, and
  leaves the tree untouched, so the plain command can be re-run after fixing.
- Re-audit the learned anchors by hand: the docs refresh rewrites current-pin
  strings and the mechanical `Current pin` line only, so `Revalidated: <date>`,
  `Current range summary`, and every `file.ts:NNN` anchor stay stale. List
  candidates with
  `grep -rnE '(frame|navigation|component|diff-dom|frame-runtime|form-navigation)\.ts:[0-9]' .opencode/skills/learned`,
  resolve the installed tree with
  `readlink -f node_modules/.pnpm/node_modules/@remix-run/component`, and check
  each hit with `sed -n '<start>,<end>p'` before changing the number.
- Map a moved anchor by content instead of guessing. Read the old install's
  line, then search the new file for that text and cite the match:
  ```sh
  OLD=$(ls -dt node_modules/.pnpm/@remix-run+component@*<old-sha>* | head -1)
  NEW=$(node -e "console.log(require.resolve('@remix-run/component/package.json',{paths:[require.resolve('remix/package.json')]}))")
  sed -n '<old-line>p' "$OLD/src/runtime/frame.ts"
  grep -n '<distinctive code from that line>' "$(dirname "$NEW")/src/runtime/frame.ts"
  ```
  Resolve the new package with `require.resolve` (or the newest `.pnpm` dir);
  an older hashed `@remix-run+component@…` copy otherwise wins and reports a
  bogus “no move”. Prefix the package when the basename is ambiguous
  (`frame.ts`, `server/stream.ts`, `database.ts` exist in several packages).
  If the text is gone, the code moved or was deleted — grep the symbol
  (`renderComponent`, `handle.update`, `EXEC_URL_ATTR`, `createControlledState`)
  and rewrite the claim, do not keep the stale line. Re-pin the provenance
  string (`at source <sha>`) only for anchors actually re-checked; historical
  mentions in `AGENTS.md`/`remix-pin-history.md` stay as written.
- Review the lines the refresher reports as skipped (`Left N historical/ambiguous
  line(s) unchanged`) instead of assuming they are current.
- A green `npm run remix:pin:check` does not validate the editorial layer: it
  compares tag/source/versions only, so `Current pin: … (N commits)` and the
  whole `Current range summary` can still describe the previous range. Observed
  2026-11-25 (`d593e542` → `8a8adc7b`): the refreshed doc claimed “2 commits”
  while the install was 18 commits ahead. Cross-check the commit count and PR
  list when filling the history entry, and diff the installed trees before
  writing the package delta.

## Preview release pair

Only two top-level entries are needed — `remix` and `@remix-run/ui`. Do not
declare `@remix-run/component`(-hmr) directly; they arrive transitively and
dedupe to one copy:

```jsonc
"remix": "https://github.com/remix-run/previews/releases/download/v0.0.20261126-main-ab07c1d8/remix.tgz",
"@remix-run/ui": "https://github.com/remix-run/previews/releases/download/v0.0.20261126-main-ab07c1d8/ui.tgz"
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
