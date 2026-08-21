## Why

The upstream `remix` package renamed all non-standard frame-navigation attributes from bare `rmx-*` to `data-rmx-*` (commit `0839bbf77`, released in `remix@3.0.0-beta.11` / `@remix-run/ui@0.8.0`). The installed build (`8bdf97f` → `preview/main`) already contains the rename, so the runtime now reads **only** `data-rmx-target`, `data-rmx-document`, `data-rmx-history`, `data-rmx-src`, `data-rmx-reset-scroll`, `data-rmx-preserve-dom`. Our app still emits the old bare names in **129 places across 30 files**, so frame targeting, document-escape, and history semantics are **silently dead at runtime**. TypeScript does not catch this because `remix/ui`'s automatic JSX runtime types `jsx()` props as `Record<string, any>` — every attribute is accepted regardless of the strict `IntrinsicElements` types.

## What Changes

- Rename all bare `rmx-target`, `rmx-src`, `rmx-document`, `rmx-history`, `rmx-reset-scroll`, `rmx-preserve-dom` attributes to their `data-rmx-*` equivalents across `app/` source.
- Update `app/ui/nav-link.tsx`'s `extra` record keys (`rmx-src`, `rmx-target`, `rmx-document`) to the `data-rmx-*` names — this is the shared nav primitive and the most critical site.
- Update `app/assets/frame-response.browser.tsx`'s `rmx-document` anchor attribute.
- Update the learned skills that reference the old attribute names (`remix3-frame-cliententry`, `remix-forms`, `remix-route-relocation`, and any others) so the deltas stay accurate against the current vendor contract.
- No behavior change: this restores the frame navigation behavior that the upstream rename silently broke.

## Capabilities

### New Capabilities

None — this is a mechanical rename restoring existing behavior, not a new capability.

### Modified Capabilities

None — `frame-navigation-conventions` describes behavior (redirects, auth fragments, history semantics), not attribute names, so no requirement changes.

This change sets `skip_specs: true` in `.openspec.yaml` because it is a pure refactor: the frame navigation behavior contract is unchanged, only the attribute spelling used to express it.

## Impact

- **Code:** 30 files under `app/` (28 `app/ui/*` + `app/actions/client/*`, `app/actions/lists/*`, `app/actions/nutzer/*`, `app/assets/frame-response.browser.tsx`).
- **Runtime:** frame targeting, `rmx-document` escape (downloads, cross-section links), and `rmx-history` semantics currently broken; restored by this rename.
- **Docs/skills:** learned deltas under `.opencode/skills/learned/` referencing `rmx-*` become stale; updated in place.
- **Dependencies:** none — works against the already-installed `remix`/`@remix-run/ui` build.