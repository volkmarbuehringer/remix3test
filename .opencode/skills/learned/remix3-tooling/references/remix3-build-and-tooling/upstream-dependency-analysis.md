# Upstream Dependency Change Impact Analysis

**Source:** `remix-upstream-dependency-analysis`

**Extracted:** 2026-07-10
**Re-validated:** 2026-11-06 (current pin is preview release `v0.20261106.150533-main-305d22d0` / source `305d22d0`; the retained-tarball and `github:…#preview/main&path:` flows below are historical)
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

## Current pin and history

Current install: `remix` 3.2.0 / `@remix-run/ui` 0.13.1 / `@remix-run/component` 1.2.0 / `component-hmr` 1.0.1 at preview release `v0.20261106.150533-main-305d22d0` (source `305d22d0`). The two `package.json` specs are the release asset URLs; the lock has 278 release tarball refs at that tag. The 2026-11-06 range changed only `packages/component/src/runtime/client-entries.ts` (type-level TS2589 fix) plus CI/build/test scripts, so existing learned line refs remain valid at this pin.

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
typecheck/lint/format/tests. `npm run remix:pin:check` verifies lock/tag
unification, HEADs the assets, and warns when the pin is not the newest main
release or is older than five days. Install retries use the universal
`--config.fetch-retries=…` / `--config.fetch-retry-*-timeout=…` form because
pnpm 12 removed the dedicated `--fetch-retries`/`--fetch-retry-*` flags.

## Preview release pair

Only two top-level entries are needed — `remix` and `@remix-run/ui`. Do not
declare `@remix-run/component`(-hmr) directly; they arrive transitively and
dedupe to one copy:

```jsonc
"remix": "https://github.com/remix-run/previews/releases/download/v0.20261106.150533-main-305d22d0/remix.tgz",
"@remix-run/ui": "https://github.com/remix-run/previews/releases/download/v0.20261106.150533-main-305d22d0/ui.tgz"
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
