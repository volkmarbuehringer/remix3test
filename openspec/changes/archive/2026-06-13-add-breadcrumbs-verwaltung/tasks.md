## 1. Add Missing Route Labels

- [x] 1.1 Add `routes.verwaltung.report1.index.href()` → `'Monatsauswertung'` to ROUTE_LABELS
- [x] 1.2 Add `routes.verwaltung.pdf.index.href()` → `'PDF-Export'` to ROUTE_LABELS
- [x] 1.3 Add `routes.verwaltung.usersExport.index.href()` → `'Benutzer-Export'` to ROUTE_LABELS
- [x] 1.4 Audit all other Verwaltung sub-routes for missing labels and add any others found — no other GET-navigable routes missing labels (remaining routes are POST-only form actions)

## 2. Verify

- [x] 2.1 Verify breadcrumb rendering on `/verwaltung/report1` shows "Verwaltung > Monatsauswertung" — confirmed via breadcrumb logic walkthrough
- [x] 2.2 Verify breadcrumb rendering on `/verwaltung/pdf` shows "Verwaltung > PDF-Export" — confirmed via breadcrumb logic walkthrough
- [x] 2.3 Verify breadcrumb rendering on `/verwaltung/users-export` shows "Verwaltung > Benutzer-Export" — confirmed via breadcrumb logic walkthrough
- [x] 2.4 Run typecheck: `npm run typecheck` — passed
- [x] 2.5 Run tests: `npm test` — 683/683 passed
