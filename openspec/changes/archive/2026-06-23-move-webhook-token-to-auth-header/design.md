## Context

Two webhook ingestion endpoints (`POST /webhook/:token` and `POST /app-webhook/:token`) currently authenticate via a URL path parameter. The CSRF middleware skips these paths using `startsWith('/webhook/')` and `startsWith('/app-webhook/')`. Both controllers strip the `authorization` header from stored request headers, indicating header-based auth was anticipated but never implemented.

External senders (e.g., hermes event processor, third-party services) currently POST to URLs containing the token. They must be updated to send the token via `Authorization: Bearer <token>` instead.

## Goals / Non-Goals

**Goals:**
- Remove token from URL path for both webhook endpoints
- Authenticate via `Authorization: Bearer <token>` header
- Keep route paths clean: `/webhook` and `/app-webhook`
- Token value still stored in `webhook_requests.token` column for audit
- Backward-compatible for the server-side contract (response format unchanged)

**Non-Goals:**
- No database schema changes
- No changes to the callback endpoint
- No changes to the webhook-requests viewer or SSE logic
- No multi-token support (single `WEBHOOK_TOKEN` env var remains)

## Decisions

1. **Bearer token scheme over custom header** — Using the standard `Authorization: Bearer` scheme aligns with HTTP conventions, is framework-agnostic, and is expected by third-party tools. Alternatives considered: custom header like `X-Webhook-Token` (non-standard, no ecosystem tooling support).

2. **Route simplification from `/webhook/:token` to `/webhook`** — Once the token is removed from the path, the parameter is unnecessary. The route becomes a clean resource path. CSRF skip must change from `startsWith('/webhook/')` to `=== '/webhook'` to avoid false matches (e.g., `/webhook-extra`).

3. **Single env var remains** — `WEBHOOK_TOKEN` continues to be the single shared token for both endpoints. No per-endpoint token separation is introduced.

4. **Token still stored in DB** — The `webhook_requests.token` column continues to capture the token value for request auditing, even though it now comes from the header instead of the URL.

5. **External callers updated independently** — The hermes integration (`app-webhook` → hermes forwarding) does not need token changes since hermes receives the webhook URL from env config, which will be updated separately.

## Risks / Trade-offs

- [**Breaking change**] → Existing webhook senders will fail with 401 until they add the `Authorization: Bearer` header and update their target URL. Mitigation: document the change clearly in deployment notes; coordinate with any external integrators.
- [**Header logging exposure**] → Reverse proxies or load balancers may log `Authorization` headers in plain text. Mitigation: ensure upstream infrastructure strips or masks sensitive headers in logs; this is the same risk as any other Bearer-auth endpoint.
- [**CSRF skip false negatives**] → Currently uses `startsWith` which is lenient. Changing to exact path matching could miss edge cases. Mitigation: verify the only two paths hitting CSRF skip are the two exact webhook paths.
