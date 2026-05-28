<!-- Context: development/remix3/guides/pr-workflow | Priority: medium | Version: 1.1 | Updated: 2026-03-29 -->

# Pull Request Workflow

How to create and manage GitHub pull requests in this repository.

## Core Concept

PRs should be concise, reviewer-friendly documents focused on problem/feature explanation, context links, and practical code examples. Avoid redundant process sections.

## Key Points

- Check git status/branches early - create branch before committing
- Gather only context needed for the PR description
- Prefer single clean commits unless multi-commit history is requested
- Check if change file is needed in `packages/*/.changes/`
- **Run lint, typecheck, and tests after code changes** (see below)

## PR Body Structure

````md
<One or two intro paragraphs explaining change and why it matters>

- <Feature/issue addressed>
- <Key behavior/API changes>
- <Expected impact>

<Optional context paragraphs with related links>

```ts
// New feature usage example
```
````

```ts
// Before vs After if applicable
```

````

## Create PR

```bash
gh pr create --base main --head <branch> --title "<title>" --body-file <file>
````

## After Code Changes

Always run these commands after making code changes:

```bash
# 1. TypeScript type checking
pnpm run typecheck

# 2. Linting
pnpm run lint

# 3. Tests (if tests exist in the project)
pnpm run test
```

If any step fails, fix the errors before continuing. These checks catch type errors, code quality issues, and regressions early.

## Checklist

- Check `git status --short --branch` before starting
- Create branch early if repo is detached HEAD
- Decide if change file is needed (check `packages/*/.changes/`)
- Use `git diff --stat` for context on small changes
- Exclude `Validation`, `Testing` sections (implicit in workflow)
- Run lint, typecheck, and tests before finishing

## Change Files

If the PR needs release notes:

- Use `make-change-file` skill for new change files
- Location: `packages/<package>/.changes/`
- Naming: `[major|minor|patch].short-description.md`
- For `0.x` packages: use `minor` for features, `patch` for fixes

## 📂 Codebase References

- `.agents/skills/make-pr/SKILL.md` - Full skill guide
- `.agents/skills/make-change-file/SKILL.md` - Change file guide

## Related

- `guides/release-process.md` - Change file conventions
- `guides/monorepo-packages.md` - Package structure
