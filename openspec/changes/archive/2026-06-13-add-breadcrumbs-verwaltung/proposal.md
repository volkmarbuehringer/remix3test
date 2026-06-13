## Why

The Verwaltung area has several sub-routes (`/report1`, `/pdf`, `/users-export`) that lack breadcrumb labels in `app/route-labels.ts`. When navigating to these pages, the breadcrumb component falls back to "Verwaltung" as the trail leaf — making it unclear where the user currently is and breaking navigation consistency with other Verwaltung pages that do show proper breadcrumbs (e.g., "Verwaltung > Angebote").

## What Changes

- Add missing breadcrumb labels for `/verwaltung/report1` (Monatsauswertung), `/verwaltung/pdf` (PDF-Export), `/verwaltung/users-export` (Benutzer-Export) to `ROUTE_LABELS`
- Verify the breadcrumb implementation correctly renders a full hierarchical trail for all Verwaltung sub-paths
- Add labels for any other Verwaltung routes that are navigable but currently missing from `ROUTE_LABELS`

## Capabilities

### New Capabilities
- `verwaltung-breadcrumbs`: Complete breadcrumb coverage for all Verwaltung sub-routes, ensuring every navigable page shows a proper hierarchical trail (e.g., "Verwaltung > Monatsauswertung")

### Modified Capabilities
- (none — only adding labels, not changing existing route requirements)

## Impact

- `app/route-labels.ts` — add 3+ new label entries
- No API, database, or dependency changes
