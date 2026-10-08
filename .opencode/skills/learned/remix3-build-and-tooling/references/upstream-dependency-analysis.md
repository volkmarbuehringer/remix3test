# Upstream Dependency Change Impact Analysis

**Source:** `remix-upstream-dependency-analysis`

**Extracted:** 2026-07-10
**Re-validated:** 2026-10-08 (vendor facts below re-checked against the installed tree at build `a36d36caa` / source `ef2c594`; version table updated from the rc.5 / 0.8.0 / 0.12.0 era to stable `remix 3.0.0` / `component 1.0.0` / `component-hmr 1.0.0` / `ui 0.12.1`)
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

5. **Verify with typecheck + tests:**
   ```bash
   npm run typecheck
   npm test
   ```

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

As of 2026-10-08 the repo still carries **three independent version lines**, so a single "remix version" no longer describes the dependency set. The app's branch pin (`preview/main`) now resolves to the generated installable-build commit `a36d36caa` (built from `ef2c594`, the merge of #11942/#11939/#11930/#11953), where `remix` has crossed to **stable `3.0.0`** and `@remix-run/component` / `-hmr` to **`1.0.0`**:

| package | version | notes |
| --- | --- | --- |
| `remix` | `3.0.0` | stable released; the prerelease-counter caveat no longer applies |
| `@remix-run/component` | `1.0.0` | runtime; aliased as `remix/component*` (crossed `0.x` → `1.0` since rc.5) |
| `@remix-run/component-hmr` | `1.0.0` | aliased as `remix/component-hmr*` (crossed `0.x` → `1.0`) |
| `@remix-run/ui` | `0.12.1` | primitives + animation; **not** aliased into `remix`, must be a direct dependency; still `0.x` |

Prior state (for git archaeology): at the `Release v3.0.0-rc.5` commit (`dba1546a0`; tag `remix@3.0.0-rc.5`) a `preview/main` install resolved to the generated installable-build commit `be58f7beb` (built from `904eb5ff3`) — `remix 3.0.0-rc.5` / `component 0.8.0` / `component-hmr 0.1.0` / `ui 0.12.0`.

`3.0.0-rc.4` with `ui 0.11.0` / `component 0.7.0` / `component-hmr 0.0.0` is the pre-release state at the split commit itself (`7513dae`).

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

