## 1. Webhook requests index page

- [x] 1.1 Remove the outer `<Document title="Webhook Requests">` wrapper in `app/actions/webhook-requests/controller.tsx` (`webhookRequestsIndex` handler) and render `<Layout title="Webhook Requests">` in its place
- [x] 1.2 Remove the now-unused `Document` import from `app/actions/webhook-requests/controller.tsx`

## 2. Webhook compose page

- [x] 2.1 Remove the outer `<Document title="Webhook erstellen">` wrapper in `app/actions/webhook-requests/create/controller.tsx` (`index` action) and render `<Layout title="Webhook erstellen">` in its place
- [x] 2.2 Remove the now-unused `Document` import from `app/actions/webhook-requests/create/controller.tsx`

## 3. Verification

- [x] 3.1 Render `GET /webhook-requests` and assert the response contains exactly one `<html>` root and `<title>Webhook Requests</title>`
- [x] 3.2 Render `GET /webhook-requests/create` and assert the response contains exactly one `<html>` root and `<title>Webhook erstellen</title>`
- [x] 3.3 Run `npm run typecheck` and `npm test`
