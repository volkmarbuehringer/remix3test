## Why

Embedding the webhook token in the URL path (`/webhook/:token`) exposes it in server logs, browser history, referrer headers, and downstream audit trails. Moving it to the `Authorization: Bearer <token>` header is a security best practice that keeps credentials out of the URL path.

## What Changes

- **BREAKING**: `POST /webhook/:token` route changes to `POST /webhook` — token read from `Authorization: Bearer` header
- **BREAKING**: `POST /app-webhook/:token` route changes to `POST /app-webhook` — same header-based auth
- Token validation reads `Authorization` header instead of `context.params.token`
- CSRF skip middleware path matching updated to exact paths `/webhook` and `/app-webhook`
- External webhook callers must update their destination URL and add the `Authorization: Bearer` header
- Existing specs updated to reflect the new auth mechanism

## Capabilities

### New Capabilities

None — this is a refactor of existing capabilities, not a new feature.

### Modified Capabilities

- `webhook-ingestion`: Authentication requirement changes from URL-param token to `Authorization: Bearer` header
- `app-webhook-hermes`: Same auth mechanism change; route path changes from `/app-webhook/:token` to `/app-webhook`

## Impact

- **Routes**: `app/routes.ts` — change `/webhook/:token` to `/webhook`, `/app-webhook/:token` to `/app-webhook`
- **Controllers**: `app/actions/webhook/controller.tsx` and `app/actions/app-webhook/controller.tsx` — replace `context.params.token` with `Authorization` header parsing
- **Middleware**: `app/middleware/skip-csrf.ts` — update path prefix matching to exact path matching
- **External callers**: Must update webhook sender configs to use `Authorization: Bearer <token>` header and drop `:token` from URL path
- **Database**: No schema changes; `webhook_requests.token` column continues to store the token value for audit
