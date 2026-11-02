# Upstream Dependency Change Impact Analysis

**Source:** `remix-upstream-dependency-analysis`

**Extracted:** 2026-07-10
**Re-validated:** 2026-10-31 (method unchanged; current pin `57ecca4cba` / source `a178e1f`)
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

## Current pin and history

Current install: `remix` 3.1.0 / `@remix-run/ui` 0.13.0 / `@remix-run/component` 1.1.0 / `component-hmr` 1.0.0 at unified build `57ecca4cba` / source `a178e1f`.

Full per-bump records (build/source pairs, PR ranges, runtime deltas, app-clearance notes, verification) live in [`docs/remix-pin-history.md`](../../../../../../docs/remix-pin-history.md). The chapter-to-skill registry is [`docs/guide-skill-coverage.md`](../../../../../../docs/guide-skill-coverage.md). Operational pnpm recipes for the branch-pinned install are in [`docs/pnpm-git-hosted-installs.md`](../../../../../../docs/pnpm-git-hosted-installs.md).

## Branch-pin transitive race

A `github:…#branch&path:…` specifier is not one resolution: `pnpm` resolves the top-level `path:` entries and the transitive `@remix-run/*` packages independently, and a later install can re-resolve the transitive set to the then-current branch tip. A mixed lock means the app may run a *newer* `@remix-run/component` than the top-level pin suggests. When auditing, inspect the **installed** transitive build (`.pnpm/@remix-run+component@*`), not just the importer's lock line, and prefer a full `pnpm update` to unify the set. The history file has dated examples.

## Release-day `package.json` pair

Only two top-level entries are needed — `remix` and `@remix-run/ui`. Do not declare `@remix-run/component`(-hmr) directly; they arrive transitively and dedupe to one copy:

```jsonc
"remix": "^3.1.0",          // stable 3.1.0 released 2026-10-23; no -rc suffix needed
"@remix-run/ui": "^0.13.0"  // 0.13.0 lands under this caret (patch within the minor)
```

**`0.x` caret caveat.** On a `0.x` package, `^0.13.0` means `>=0.13.0 <0.14.0` — it locks the minor and allows only patches. That is the correct pin: a `0.x` minor can be breaking (0.11 -> 0.12 deleted the styled `button`/`breadcrumbs`/`checkbox`/`input`/`radio` modules plus the package-root runtime and JSX exports; 0.12 -> 0.13 removed the styled wrapper prop types and renamed `toggle.control` to `toggle`). Do not widen it to `>=0.13.0`.

**Git-spec equivalent.** If the app keeps `github:` specs instead of npm versions there is no number to write — pin **both** `path:` entries to the same ref/SHA so only one `@remix-run/component` resolves:

```jsonc
"remix":         "github:remix-run/remix#<ref-or-sha>&path:packages/remix",
"@remix-run/ui": "github:remix-run/remix#<ref-or-sha>&path:packages/ui"
```

## When to Use

- A project depends on a library via `github:owner/repo#branch&path:subdir`
- Upstream commits have landed on that branch
- Before running `pnpm update <dep>` or `npm update <dep>`
- When debugging regressions after a dependency update
