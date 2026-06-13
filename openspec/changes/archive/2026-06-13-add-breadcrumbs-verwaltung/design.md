## Context

The app already has a working breadcrumb system:
- `app/ui/breadcrumbs.tsx` — `Breadcrumbs` component + `getBreadcrumbs()` function
- `app/route-labels.ts` — `ROUTE_LABELS` map from pathname → human-readable label
- The standard `Layout` component renders breadcrumbs for all paths except `/admin` and `/ai`

Currently the ROUTE_LABELS map is missing entries for several Verwaltung sub-routes, so `getBreadcrumbs()` falls back to partial parent matches, showing only "Verwaltung" instead of a full trail like "Verwaltung > Monatsauswertung".

## Goals / Non-Goals

**Goals:**
- Every navigable Verwaltung sub-page shows a complete breadcrumb trail
- All missing ROUTE_LABELS entries are added for Verwaltung routes
- No visual or functional regressions to existing breadcrumbs

**Non-Goals:**
- No changes to the breadcrumb component (`getBreadcrumbs`) or rendering logic
- No changes to route structure, controllers, or UI components
- No new breadcrumb styles or layout changes

## Decisions

- **Add only missing labels, do not refactor**: The existing breadcrumb system is sound. Only `ROUTE_LABELS` entries need adding. No architectural changes required.
- **Labels follow existing naming conventions**: German labels to match the surrounding Verwaltung UI (e.g., "Monatsauswertung", "PDF-Export", "Benutzer-Export").
- **Verify via test**: The breadcrumbs module has test coverage; add or extend tests if the existing coverage doesn't already cover the new paths.

## Risks / Trade-offs

- Labels must stay in sync if routes are renamed — this is an existing risk for all ROUTE_LABELS entries.
