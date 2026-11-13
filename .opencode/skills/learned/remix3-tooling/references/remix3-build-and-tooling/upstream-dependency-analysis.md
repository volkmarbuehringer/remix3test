# Upstream Dependency Change Impact Analysis

**Source:** `remix-upstream-dependency-analysis`

**Extracted:** 2026-07-10
**Re-validated:** 2026-11-13 (current pin is preview release `v0.20261113.174821-main-9ceaeb82` / source `9ceaeb82`; the retained-tarball and `github:…#preview/main&path:` flows below are historical)
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

4b. **Audit code that shadows a changed vendor default.** If the app replaces a default the changed package exports (`run({ resolveFrame })` shadows `defaultResolveFrame`), the upstream fix never reaches it — diff the override against the new default and port the change. #11938 changed `getRequestBody` in `packages/component/src/runtime/run.ts` and `packages/spa/src/lib/spa.ts`; `app/assets/frame-response.browser.tsx` had to be re-synced by hand. Since #12249 the default itself is exported: prefer `defaultResolveFrame(src, options, { fetch, commit })` over copying its request/redirect/stream logic. The `fetch` callback can return a cached `Response` (the one-shot warm-cache case) and `commit` wraps rendering for view transitions; the callback is keyed by response identity, so return that response unchanged.

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

Current install: `remix` 3.2.0 / `@remix-run/ui` 0.13.1 / `@remix-run/component` 1.2.0 / `component-hmr` 1.0.1 at preview release `v0.20261113.174821-main-9ceaeb82` (source `9ceaeb82`). The two `package.json` specs are the release asset URLs; the lock has 278 release tarball refs at that tag.

Current range (#12297, #12249): `@remix-run/headers` unifies `Accept`/`AcceptEncoding`/`AcceptLanguage` on an internal `WeightedHeaderValue` base and `getWeight()` picks the most specific matching range; `@remix-run/response` `compressResponse()` honors `identity;q=0` and falls back to uncompressed for an unlisted identity; `@remix-run/component` exports `defaultResolveFrame(src, options?, { fetch, commit })` and the `FrameCommit` types, adds `transition?: NavigationTransition` to `ResolveFrameOptions`, and threads it through frame/navigation/prefetch. `packages/ui`, the CLI/template, and all 15 guides are byte-identical.

App state: property/accessor mocks are used in three tests; the pre-#12290 HMR forward-declaration workaround is removed; `t.waitFor()` is used across browser tests; built-in `Frame loading="lazy"` covers the dashboard cards, recent-activity details, and chatlog detail pane; grid pagers use `data-rmx-prefetch="viewport"`. The #12249 commit hook is not adopted — `app/assets/entry.tsx` still owns a full custom `resolveFrame` for the one-shot prefill/warm cache. Per-bump records (PR ranges, runtime deltas, anchor shifts, verification) live in `docs/remix-pin-history.md`; line anchors live in the owning learned references.

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
"remix": "https://github.com/remix-run/previews/releases/download/v0.20261113.174821-main-9ceaeb82/remix.tgz",
"@remix-run/ui": "https://github.com/remix-run/previews/releases/download/v0.20261113.174821-main-9ceaeb82/ui.tgz"
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
