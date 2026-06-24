## Why

The `/ui` and `/ui/:component` routes serve a development-only UI component showcase (button styles, form inputs, theme tokens). These routes are publicly accessible with no auth middleware and are not linked from any navigation — they were discovered by someone guessing the URL. The showcase has no ongoing use case and exposes internal UI patterns unnecessarily.

## What Changes

- Remove the `ui` route (`GET /ui`) and `uiComponent` route (`GET /ui/:component`) from `app/routes.ts`
- Remove the `ui` and `uiComponent` action handlers from the home controller
- Delete the showcase page components and registry (`showcase-pages.tsx`, `showcase-registry.ts`)
- Delete the UI showcase test files
- Remove UI showcase label entries from `route-labels.ts`
- The shared `page-primitives.tsx` utilities are preserved (still used by uploads, lists, settings, and auth pages)

## Capabilities

### New Capabilities
*(none — this is pure removal)*

### Modified Capabilities
*(none — no spec-level behavior changes)*

## Impact

- `app/routes.ts` — two route definitions removed
- `app/actions/home/controller.tsx` — two action handlers and two imports removed
- `app/route-labels.ts` — four label entries removed
- `app/ui/showcase-pages.tsx` — deleted (only used by `/ui`)
- `app/ui/showcase-registry.ts` — deleted (only used by `/ui`)
- `app/ui/showcase-registry.test.ts` — deleted
- `app/actions/home/controller.ui.test.ts` — deleted
- No breaking changes — no in-app navigation links referenced these routes
- `app/ui/page-primitives.tsx` — unchanged (shared utility still in use)
