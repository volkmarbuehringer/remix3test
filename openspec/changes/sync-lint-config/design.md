## Context

This app's lint config was scaffolded from the Remix template and has drifted slightly from upstream. The Remix repo recently tightened lint to treat warnings as errors and made category rules explicit. This app should mirror those changes since it tracks Remix's lint tooling (oxlint, custom plugins).

## Goals / Non-Goals

**Goals:**
- Match the lint behavior of the upstream Remix repo
- Clean up stale ignorePatterns from the Remix template that don't apply here

**Non-Goals:**
- Adding new lint rules beyond what upstream has
- Changing formatter config (Prettier)

## Decisions

- **`--max-warnings=0` over `-A all`**: Upstream moved from silencing warnings to failing on them. This is stricter and catches issues earlier. Adopt the same approach.
- **Explicit category overrides**: Adding all categories as `"off"` makes the config self-documenting — no rules leak in from oxlint's default sets. This matches upstream exactly.
- **Remove stale ignores**: `demos/bookstore`, `demos/sse`, `packages/multipart-parser` etc don't exist in this app. Keeping them is misleading.

## Risks / Trade-offs

- [New lint failures] `--max-warnings=0` may surface existing warnings that need fixing. Mitigation: run `npm run lint` after changes and fix or explicitly disable any false positives.
