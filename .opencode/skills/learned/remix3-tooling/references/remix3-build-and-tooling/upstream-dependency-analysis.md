# Upstream Dependency Change Impact Analysis

**Source:** `remix-upstream-dependency-analysis`

**Extracted:** 2026-07-10
**Re-validated:** 2026-11-03 (current pin is the retained tarball build `t/c26a37eb` / source `c26a37ebe`; the `github:…#preview/main&path:` flow below is historical)
**Context:** A project pins a dependency to a preview build — retained `t/<sha>/<pkg>.tgz` tarballs since #12126, or the old `github:owner/repo#branch&path:subdir` layout — and upstream commits land. Need to determine whether updating the dependency would break the project.

## Problem

When a dependency is pinned to a GitHub branch (e.g. `"remix": "github:remix-run/remix#preview/main&path:packages/remix"`) or to preview tarball URLs, upstream changes are opaque — a floating `npm update`/`pnpm update` fetches the branch tip, while a tarball pin silently ages and its retained URL can be pruned. You need to know:

- What commits landed upstream
- Whether any of them change APIs your project uses
- Whether updating would introduce breakage

## Solution

Trace the chain from upstream changes to project impact:

1. **Find the pinned build** in the lockfile:
   - current tarball pin: `https://raw.githubusercontent.com/remix-run/remix/preview/main/t/<source-sha-8>/<pkg>.tgz`
   - old branch pin (historical): `https://codeload.github.com/.../<build-commit>#path:...`

2. **Fetch upstream changes** and compare. For a tarball pin, expand the 8-hex
   source prefix (`git ls-remote` has only branch tips; the GitHub commits API
   accepts the short SHA) and use the source commit:
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

Current install: `remix` 3.1.0 / `@remix-run/ui` 0.13.0 / `@remix-run/component` 1.1.0 / `component-hmr` 1.0.0 at retained tarball build `t/c26a37eb` (source `c26a37ebe`, `preview/main` build `cc2a50e2a0`). The two `package.json` specs are the manifest URLs; the lock has 270 tarball refs at that prefix.

Full per-bump records (build/source pairs, PR ranges, runtime deltas, app-clearance notes, verification) live in [`docs/remix-pin-history.md`](../../../../../../docs/remix-pin-history.md). The chapter-to-skill registry is [`docs/guide-skill-coverage.md`](../../../../../../docs/guide-skill-coverage.md). Operational pnpm recipes are in [`docs/pnpm-remix-preview-installs.md`](../../../../../../docs/pnpm-remix-preview-installs.md) (current tarball flow); old `github:…#path:` recipes are in [`docs/history/pnpm-git-hosted-installs.md`](../../../../../../docs/history/pnpm-git-hosted-installs.md).

## Preview tarball installs (post-#12126)

Since the 2026-11-03 migration the app pins the two tarball URLs from
`t/preview.json`, not `github:…#branch&path:`. Each `preview/main` build commit
carries `t/<source-sha>/<pkg>.tgz`; every tarball rewrites its `@remix-run/*`
dependencies to the same build's tarball URL. The lock is content-addressed, so
the old branch-pin transitive race cannot recur: there is no independent
`path:` resolution left to drift.

- Resolve `preview/main` with `git ls-remote`, then fetch
  `t/preview.json` **from that build commit** (the branch file is CDN-cached),
  and verify both package URLs share `manifest.sha.slice(0, 8)`.
- Retained builds are pruned after ~7 days (the latest is always kept), so an
  old lock's `t/<sha>` URL can 404 after retention. Refresh before then.
- The `github:…#preview/main&path:` layout is no longer installable from current
  builds because `packages/*/dist` is not committed. Its historical race: pnpm
  resolved the top-level `path:` entries and the transitive `@remix-run/*`
  paths independently, so a mixed lock could run a newer `component` than the
  top-level pin. The pin history has dated examples.

`npm run update:remix` automates the tarball flow: read the manifest, rewrite
both specs, install, verify one `t/<sha>` prefix, frozen check, skill links,
typecheck/lint/format/tests.

## Preview tarball pair

Only two top-level entries are needed — `remix` and `@remix-run/ui`. Do not
declare `@remix-run/component`(-hmr) directly; they arrive transitively and
dedupe to one copy:

```jsonc
"remix": "https://raw.githubusercontent.com/remix-run/remix/preview/main/t/c26a37eb/remix.tgz",
"@remix-run/ui": "https://raw.githubusercontent.com/remix-run/remix/preview/main/t/c26a37eb/ui.tgz"
```

Both must come from the same manifest build. Do not hand-pin one and leave the
other on an older `t/<sha>`.

**Released npm versions instead.** If the app leaves the preview line for
published versions, `^3.1.0` / `^0.13.0` are the release-day pair. On a `0.x`
package, `^0.13.0` means `>=0.13.0 <0.14.0` — it locks the minor and allows only
patches, which is correct because a `0.x` minor can be breaking (0.11 -> 0.12
deleted the styled `button`/`breadcrumbs`/`checkbox`/`input`/`radio` modules plus
the package-root runtime and JSX exports; 0.12 -> 0.13 removed the styled
wrapper prop types and renamed `toggle.control` to `toggle`). Do not widen it to
`>=0.13.0`.

## When to Use

- A project pins Remix previews as retained tarballs (or, historically,
  `github:owner/repo#branch&path:subdir`) and upstream has moved
- Before running `npm run update:remix`, `pnpm update <dep>` or `npm update <dep>`
- When debugging regressions after a dependency update
