---
title: Branching and Releasing in Remix 3
category: concepts
type: context
source: /home/lucky/remix/decisions/002-branching-and-releasing.md
tags: [remix3, concepts, design-decisions, release-process]
---

# Branching and Releasing in Remix 3

## Core Concept
Remix 3 uses a `main` branch for daily development and a `future` branch for breaking changes. Major releases follow a predetermined schedule to avoid frequent breaking changes for users.

## Key Points
- `main` branch is always publishable with frequent minor/patch releases
- Breaking changes accumulate on `future` branch for preview and sub-package releases
- Major `remix` releases happen on a fixed schedule for user upgrade planning
- `future` branch merges into `main` when cutting new major versions
- Sub-packages can release breaking changes independently on `future`

## Example
```bash
# Main branch workflow
git checkout main
pnpm version patch
pnpm publish

# Future branch for breaking changes
git checkout future
# Make breaking changes
pnpm version major --scope @remix-run/some-package
```

## Reference
- [Remix Contributing Guide](https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md)
