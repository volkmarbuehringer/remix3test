## 1. Route Definition

- [x] 1.1 Add `usersPdf` sub-route under `verwaltung` in `app/routes.ts` with `index: get('/')`
- [x] 1.2 Add route label for `verwaltung.usersPdf.index` in `app/route-labels.ts`

## 2. Controller

- [x] 2.1 Create `app/actions/verwaltung/users-pdf/controller.tsx` with `createController` following the existing PDF pattern
- [x] 2.2 Implement the SQL query
- [x] 2.3 Build the pdfmake `TDocumentDefinitions` with header "Benutzerübersicht", current date subtitle, total user count, and a table with columns: Name, E-Mail, Termine, Gesamtzeit, Erster Termin, Letzter Termin
- [x] 2.4 Add frame-to-full-page redirect (X-Remix-Frame header check)
- [x] 2.5 Add error handling with 500 response

## 3. Router Registration

- [x] 3.1 Import the new controller in `app/router.ts`
- [x] 3.2 Add `router.map(routes.verwaltung.usersPdf, verwaltungUsersPdf)` call

## 4. Dashboard Card

- [x] 4.1 Add a "Benutzer-PDF" card to the dashboard in `app/ui/verwaltung-page.tsx` with `rmx-document` attribute on the link

## 5. Tests

- [x] 5.1 Create `app/actions/verwaltung/users-pdf/controller.test.ts` with tests for: PDF download returns 200 with correct headers, PDF buffer starts with `%PDF`, non-admin gets 403, unauthenticated gets redirect

## 6. Verification

- [x] 6.1 Run `npm run typecheck` — only pre-existing errors (unrelated to this change)
- [x] 6.2 Run `npm test` — 823 pass, 0 fail, 1 todo (all pass, no regressions)
