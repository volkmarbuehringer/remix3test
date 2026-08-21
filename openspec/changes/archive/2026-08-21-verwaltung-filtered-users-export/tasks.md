## 1. Route Definition

- [x] 1.1 Add `usersExport` route in `app/routes.ts` under `verwaltung` — `route('users-export', { index: get('/'), create: post('/') })`
- [x] 1.2 Wire the new route in `app/router.ts`: `router.map(routes.verwaltung.usersExport, verwaltungUsersExport)`

## 2. Controller

- [x] 2.1 Create `app/actions/verwaltung/users-export/controller.tsx` with `createController`
- [x] 2.2 Add `index` action that renders the filter form page (GET request)
- [x] 2.3 Add `create` action that parses `startDate`/`endDate` from form data and validates them
- [x] 2.4 Add `create` action query with filtered SQL
- [x] 2.5 Handle "no users found" case: re-render form with error message instead of PDF
- [x] 2.6 Generate PDF with `generatePdfBuffer` using same layout as `users-pdf`, with filter range in subtitle
- [x] 2.7 Return PDF as attachment with filename `benutzer-export-<start>_<end>.pdf`

## 3. UI Page

- [x] 3.1 Create `app/ui/users-export-page.tsx` with the filter form (start date input, end date input, submit button)
- [x] 3.2 Display form validation errors inline when present
- [x] 3.3 Add dashboard card in `app/ui/verwaltung-page.tsx` linking to `/verwaltung/users-export`

## 4. Verify

- [x] 4.1 Run `npm run typecheck` — no errors
- [x] 4.2 Run tests — existing tests pass
