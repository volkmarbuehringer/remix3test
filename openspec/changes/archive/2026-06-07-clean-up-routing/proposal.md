## Why

The app's route definitions in `app/routes.ts` are fully typesafe (typed `route()`/`get()`/`post()` objects), but the UI layer largely ignores them — form actions, frame sources, client-side `fetch()` calls, and redirect URLs are hardcoded as raw strings throughout `app/ui/` and `app/assets/`. This creates a maintenance hazard: renaming a route in `routes.ts` won't flag the dozens of string literals that will silently break, and the manually-duplicated `route-labels.ts` will drift out of sync.

## What Changes

- Convert all hardcoded `/admin/*`, `/verwaltung/*`, `/appointment/*`, and `/auth/*` URL strings in UI components (`app/ui/`) to typed `routes.X.href()` calls
- Convert hardcoded URL strings in client-side assets (`app/assets/`) — context menus, connection indicators, delete buttons — to typed route references
- Replace the hand-maintained `ROUTE_LABELS` string map with route-derived label registration
- Ensure all three `.href()` registrations in `router.ts` become fully `router.map()` calls

## Capabilities

### New Capabilities

_(None — this is a pure refactoring. Route behavior and URLs remain identical.)_

### Modified Capabilities

- `breadcrumb-auto-sync`: The `route-labels.ts` system is replaced, which feeds the breadcrumb component. Labels are now registered alongside route definitions rather than in a separate string map.

## Impact

- **~15 UI page components** in `app/ui/` — form `action`, `<a href>`, `buildCancelUrl()`, `fetch()`, `<Frame src>`, `<ConnectionIndicator url>` props
- **~4 client assets** in `app/assets/` — context menus, delete buttons, connection indicators
- **`app/ui/route-labels.ts`** — replaced with a type-registration pattern
- **`app/router.ts`** — 3 routes switched from `.href()` + `router.get/post()` to `router.map()`
- **`app/routes.ts`** — may need minor adjustments to export route objects needed by UI
