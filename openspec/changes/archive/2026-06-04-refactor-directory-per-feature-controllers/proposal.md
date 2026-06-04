## Why

The newapp `app/actions/` directory contains ~30 flat controller files with long hyphenated names like `admin-appointments-controller.tsx`, with their tests and page components scattered alongside them. This flat structure creates high cognitive overhead when navigating the codebase, makes it harder to discover which files belong together, and diverges from the directory-per-feature pattern already established by `client/` and `nutzer/`. Consolidating each feature's controller, page components, and tests into a single directory aligns with established patterns and reduces file sprawl.

## What Changes

- Move each flat controller (`*-controller.tsx`) into a feature directory with `controller.tsx` as the canonical name
- Move associated test files (`*.test.ts`, `*.test.tsx`) into the feature directory alongside the controller
- Move associated page components (e.g., `lists-show-page.tsx`) into their feature directories as `page.tsx` or `*-page.tsx`
- Update all import paths in `app/router.ts` and any cross-controller references
- Use `git mv` for all file moves to preserve version history
- Existing feature-directory controllers `client/` and `nutzer/` remain unchanged
- No behavioral changes — routing, rendering, tests, and APIs remain identical

## Capabilities

### New Capabilities

- `controller-feature-colocation`: Flat controller files are restructured into feature directories where controller, page components, and tests are colocated, matching the established `client/` and `nutzer/` patterns.

### Modified Capabilities

_None._ This is a structural refactor with no specification-level requirement changes.

## Impact

- **Affected files**: ~40+ files in `newapp/app/actions/` moved/renamed; 1 file (`newapp/app/router.ts`) with updated imports
- **No API changes**: Route paths, middleware, render behavior, and HTTP responses remain identical
- **No dependency changes**: Same Remix 3, same `remix/ui` imports, same database layer
- **Test infrastructure**: Test files move alongside their controllers; no test framework or configuration changes
