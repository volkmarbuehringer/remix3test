## 1. Route and Controller Setup

- [x] 1.1 Add `put('/webhook-requests/:id')` route in `app/routes.ts`
- [x] 1.2 Wire the new PUT route in `app/router.ts` pointing to a `webhookRequestsUpdate` action
- [x] 1.3 Add `update` handler in `app/actions/webhook-requests/controller.tsx` that reads `payload` from form data, validates as flat JSON object, runs `UPDATE webhook_requests SET payload = $1 WHERE id = $2`, and redirects back to `/webhook-requests` with `?editing=` and grid state preserved

## 2. Extend WebhookComposer for Edit Mode

- [x] 2.1 Add optional `initialPayload` and `editId` props to `WebhookComposer` — when `editId` is set, the form action becomes `PUT /webhook-requests/<editId>`, the form includes `GridStateHiddenInputs`, and rows are pre-populated from `initialPayload`
- [x] 2.2 Add a helper to flatten a `Record<string, unknown>` into `Row[]` for pre-population: non-string values are `String()` or `JSON.stringify()`-ified
- [x] 2.3 Change form rendering: when in edit mode, submit button text reads "Speichern" and cancel link removes `?editing=` from URL

## 3. Update Webhook Requests Grid Page

- [x] 3.1 Add "Edit" link per row in `webhook-requests-page.tsx` (Aktion column, before the resend form) using `buildEditUrl` to set `?editing=<id>` with current grid state
- [x] 3.2 Update the page component to accept optional `editRow` prop and render a two-column layout (`gridTemplateColumns: '1fr 380px'`) when editing is active, with the grid on the left and the `WebhookComposer` (in edit mode) on the right in a sticky panel
- [x] 3.3 Apply `editingRow` styling to the row being edited
- [x] 3.4 Grid state hidden inputs (_offset, _sort, _order, _filter) rendered inline in WebhookComposer edit form

## 4. Update Webhook Requests Controller for Edit Mode

- [x] 4.1 In `loadPageData` or the index handler, read `?editing=<id>` from URL, fetch the single row by UUID, and pass as `editRow` prop to the page
- [x] 4.2 Read grid state params from the URL and pass them to the edit panel (offset, sort, order, filter) so the edit form can include `GridStateHiddenInputs`

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and fix any type errors
- [ ] 5.2 Run `npm test` and ensure existing tests pass
- [x] 5.3 Run `npm run start` and manually verify: click edit on a row, see pre-populated payload in sidebar, modify and save, verify payload is updated in DB and grid
