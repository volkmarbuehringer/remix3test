---
name: remix-upstream-dependency-analysis
description: "Check whether upstream changes to a branch-pinned GitHub dependency affect your project"
user-invocable: false
origin: auto-extracted
---

# Upstream Dependency Change Impact Analysis

**Extracted:** 2026-07-10
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
- **New features** — generally safe but may need opt-in adoption
- **Renamed exports** — look for `renamed|moved|deleted` in changelogs

## When to Use

- A project depends on a library via `github:owner/repo#branch&path:subdir`
- Upstream commits have landed on that branch
- Before running `pnpm update <dep>` or `npm update <dep>`
- When debugging regressions after a dependency update
