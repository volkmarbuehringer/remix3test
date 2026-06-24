## 1. Route and Navigation

- [x] 1.1 Add `webhookCreateRoute = form('/webhook-requests/create')` to `app/routes.ts`
- [x] 1.2 Wire the route in `app/router.ts` with `router.map()`
- [x] 1.3 Add "Compose" button (link) to the header of the existing webhook-requests page at `app/ui/webhook-requests-page.tsx`

## 2. Controller

- [x] 2.1 Create `app/actions/webhook-requests/create/controller.tsx` with `createController` handling GET (index) and POST (action)
- [x] 2.2 POST handler: parse `payload` from form body, validate it's a valid object, filter out empty-key entries, INSERT into `webhook_requests` with `token=''`, `headers='{}'`, `source_ip`, `created_at`
- [x] 2.3 POST handler: 303 redirect to `/webhook-requests` on success

## 3. ClientEntry: Webhook Composer Grid

- [x] 3.1 Create `app/assets/webhook-composer.tsx` with `clientEntry` managing `rows: Array<{ key: string, value: string }>`
- [x] 3.2 Implement addRow, removeRow, updateKey, updateValue functions
- [x] 3.3 Render grid table with key input, value input, remove button per row
- [x] 3.4 Render "Add Row" button below the grid
- [x] 3.5 Render live JSON preview in a `<pre>` block derived from rows
- [x] 3.6 Sync serialized JSON to hidden form input on every render (value attribute)
- [x] 3.7 Render Cancel link (to `/webhook-requests`) and "In Tabelle speichern" submit button

## 4. Page Shell

- [x] 4.1 Create `app/ui/webhook-composer-page.tsx` wrapping the clientEntry in a page layout matching the admin style
- [x] 4.2 Wire the page with `Document` and `Layout`

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and fix any type errors
- [x] 5.2 Run `npm test` and ensure existing tests pass
