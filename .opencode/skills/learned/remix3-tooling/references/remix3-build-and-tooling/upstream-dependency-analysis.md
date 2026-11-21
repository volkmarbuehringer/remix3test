# Upstream Dependency Change Impact Analysis

**Source:** `remix-upstream-dependency-analysis`

**Extracted:** 2026-07-10
**Re-validated:** 2026-11-18 (current pin is preview release `v0.0.20261117-main-b4185ba2` / source `b4185ba2`; the retained-tarball and `github:…#preview/main&path:` flows below are historical)
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

Current install: `remix` 3.3.0 / `@remix-run/ui` 0.14.0 / `@remix-run/component` 1.3.0 / `component-hmr` 1.0.2 at preview release `v0.0.20261120-main-275f353c` (source `275f353c`). The two `package.json` specs are the release asset URLs; the lock has 278 release tarball refs at that tag.

Current pin: `01e5b5d4` → `275f353c` (4 commits).

Current range summary: no component/frame/navigation change. `@remix-run/test` gives each browser test file a fresh history budget and retries a WebKit history-quota failure once after an 11-second backoff, and `RunTestsOptions` gains an optional `onHistoryQuotaExceeded` hook (#12350). `@remix-run/lazy-file` reads `LazyBlob`/`LazyFile` content via `getReader()` when `ReadableStream[Symbol.asyncIterator]` is missing (#12370). `@remix-run/ui`'s toast skips the `--toast-countdown` animation when `CSS.registerProperty` is unavailable (#12370). `@remix-run/data-schema`'s `object()`/`record()` define accepted keys as own properties, preserving `__proto__` and transformed record keys (#12373). #12371 is CI/test-only (shared Playwright configs, `scripts/test-browser.ts`, demo/docs test edits). Versions are unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2; four pending patch changesets) and all 15 guides are byte-identical. The previous range (`9e4da4d3` → `01e5b5d4`, 5 commits): only two shipped source files — `@remix-run/component/src/runtime/navigation.ts` (+72/−2, #12295 best-effort traversal scroll restoration for WebKit **and** Firefox: per-history-entry snapshots, an input-timestamp guard, restore only when `history.scrollRestoration === 'auto'`) and `@remix-run/node-fetch-server/src/lib/request-listener.ts` (+22/−6, #12368 rejects a literal backslash in the request path before WHATWG URL parsing normalizes it, via `RequestTargetError` → default 400; query and percent-encoded backslashes stay accepted). #12356/#12358/#12369 are test-only (`scripts/utils/preview.test.ts`, `docs/site/app/router.test.ts`, `packages/assets/.../asset-server.test.ts`), all 15 guides are byte-identical, and versions are unchanged (`remix` 3.3.0, `ui` 0.14.0, `component` 1.3.0, `component-hmr` 1.0.2; two pending patch changesets). Before that, `74f06706` → `9e4da4d3` (4 commits) was #12349's PR-preview path filter, #12348's empty-string hydration ordering fix (`reconcile.ts` +9), #12352's guide-04/cookie docs, and #12355's docs-site markdown; `74f06706` was the 3.3.0 release plus the breaking data-table array/`column.json()` changes (`b4185ba2` → `74f06706`, 14 commits). The `9cbc5144` → `b4185ba2` range (3 commits) had no package source change, #12294 was the only change in `ab790c88` → `9cbc5144`, and #12314's browser-runtime fold was `9b0ff351` → `ab790c88`; earlier ranges are in `docs/remix-pin-history.md`.

App state: property/accessor mocks are used in three tests; the pre-#12290 HMR forward-declaration workaround is removed; `t.waitFor()` is used across browser tests; built-in `Frame loading="lazy"` covers the dashboard cards, recent-activity details, and chatlog detail pane; grid pagers use `data-rmx-prefetch="viewport"`. **Both prefetch/resolve hooks were already adopted before this pin**: `app/assets/frame-response.browser.tsx` delegates to `defaultResolveFrame(..., { fetch, commit })` and keeps only `classifyFrameResponse` plus the request policy; `app/assets/frame-prefetch.browser.ts` delegates to `defaultPrefetch(src, options, { fetch, processFrame })`, stores a clone in the one-shot cache, and feeds the vendor's parsed assets into the app hint creator. The scoped admin-lists grid ⇄ editor frame swap uses the commit hook (`app/assets/frame-transition.browser.ts`). #12277's per-caller `options.signal` is deliberately not forwarded to the shared warm fetch: the navigation claims the response before unmounting the anchor, so aborting the fetch with the caller's signal errors the cached body mid-render (fixed after a week-nav e2e regression; see `remix3-ui` → `frame-prefetch-cache.md`). The store is still refused when the caller aborts before the response arrives. Neither `options.navigationType`/`options.from` (nor their removed `transition` predecessor) is used for caching: fragments are `no-store` and the in-memory one-shot cache already covers the useful case, with no measured win to gate on (Task 4 decision). #12294 needs no app source change: the app's frame forms already listen for the replayed `input`/`change` phases (`app/actions/lists/public/lists-view.tsx` field handlers, `app/ui/filter-autosubmit.browser.tsx`), so a value edited before its control hydrates now reaches app state once instead of being reset; nothing depended on the old overwrite. **#12295 needs no app source change:** the vendor restore is window-level and only for `history.scrollRestoration === 'auto'`; the app's `app/ui/page-scroll-reset.browser.tsx` resets nested `[data-page-scroller]`/`[data-grid-scroll]` containers, and `app/actions/scroll-restoration/scroll-restoration.test.e2e.ts` + `scroll-anchoring.test.e2e.ts` (Chromium + Firefox) are the guards. **#12368 needs no app source change:** the app's `onError` in `server.ts`/`app/utils/server-handler.ts` still returns its own 500 page, which masks the upstream default 400 for invalid targets and authorities (same as before the bump); `getSafeReturnTo()` in `app/utils/redirect.ts` already rejects a return path starting with a backslash. **Navigation UI adoption:** `app/ui/pending-submit.browser.tsx` uses `on('rmx:navigation', …)` + `event.finished` (renamed from `rmx:submission` at #12306); `app/ui/filter-autosubmit.browser.tsx` checks `navigation.element` is its own form before remembering the filter and uses `reloadStart` metadata only for programmatic reloads. Per-bump records (PR ranges, runtime deltas, anchor shifts, verification) live in `docs/remix-pin-history.md`; line anchors live in the owning learned references.

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
- Review the lines the refresher reports as skipped (`Left N historical/ambiguous
  line(s) unchanged`) instead of assuming they are current.

## Preview release pair

Only two top-level entries are needed — `remix` and `@remix-run/ui`. Do not
declare `@remix-run/component`(-hmr) directly; they arrive transitively and
dedupe to one copy:

```jsonc
"remix": "https://github.com/remix-run/previews/releases/download/v0.0.20261120-main-275f353c/remix.tgz",
"@remix-run/ui": "https://github.com/remix-run/previews/releases/download/v0.0.20261120-main-275f353c/ui.tgz"
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
