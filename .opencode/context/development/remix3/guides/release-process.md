<!-- Context: development/remix3/guides/release-process | Priority: medium | Version: 1.0 | Updated: 2026-03-24 -->

# Release Process

How to create change files and manage releases in this repository.

## Core Concept

Change files in `packages/*/.changes/` document user-facing changes for release notes. Use deterministic naming and follow semver rules for bump types.

## Key Points

- Change files go in `packages/<name>/.changes/`
- Naming: `[major|minor|patch].short-description.md`
- Check for existing unpublished files before creating new ones
- Use `pnpm changes:preview` to verify rendered output
- For `0.x` packages: `minor` for features, `patch` for fixes

## Bump Rules

| Package Version | Change Type     | Bump                                     |
| --------------- | --------------- | ---------------------------------------- |
| `0.x`           | New feature     | `minor`                                  |
| `0.x`           | Bug fix         | `patch`                                  |
| `0.x`           | Breaking change | `minor` (with `BREAKING CHANGE:` prefix) |
| `1.x+`          | Standard semver | `major/minor/patch`                      |

## Change File Format

```md
---
'remix/fetch-router': minor
---

- New `createRouter` function with pattern matching
- Added `middleware` option for request processing
```

## Naming Convention

```bash
# New feature
minor.new-feature-name.md

# Bug fix
patch.fix-description.md

# Breaking change
minor.breaking-change-description.md

# Remix export updates
minor.remix.update-exports.md

# Initial release
minor.initial-release.md
```

## Workflow

1. Check existing unpublished `.changes/` files first
2. If one exists for same work, update in place
3. Write concise, user-facing release notes
4. Preview: `pnpm changes:preview`
5. Verify: `pnpm run lint`

## Content Rules

- Document user-visible behavior, not implementation details
- Describe public API changes, exports, migrations
- Prefer grouped notes over many tiny files
- No manual hard-wrapping - let rendered output wrap naturally
- For Remix export changes, describe `remix/...` entrypoints

## Checklist

- [ ] Checked existing unpublished files
- [ ] Correct bump type for package version
- [ ] Reused deterministic filename if pattern exists
- [ ] User-facing content, not implementation details
- [ ] `pnpm changes:preview` renders correctly

## 📂 Codebase References

- `.agents/skills/make-change-file/SKILL.md` - Full skill guide
- `packages/fetch-router/.changes/` - Change file examples

## Related

- `guides/pr-workflow.md` - PR workflow
- `guides/monorepo-packages.md` - Package conventions
