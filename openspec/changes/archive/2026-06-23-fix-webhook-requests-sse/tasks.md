## 1. SSE Channel: Add `invalidate` event to webhookChannel

- [x] 1.1 Extend the `EventMap` in `app/lib/sse-events.ts` to include `invalidate: void`
- [x] 1.2 Add `webhookChannel.broadcast('invalidate')` after `broadcast('new_request')` in `app/actions/webhook/controller.tsx`
- [x] 1.3 Add `webhookChannel.broadcast('invalidate')` after `broadcast('new_request')` in `app/actions/app-webhook/controller.tsx`
- [x] 1.4 Add `webhookChannel.broadcast('invalidate')` after `broadcast('callback_received')` in `app/actions/callback/controller.tsx`
- [x] 1.5 Add `webhookChannel.broadcast('invalidate')` alongside `broadcast('new_request')` in `app/actions/webhook-requests/controller.tsx` (resend handler)

## 2. Webhook Requests Page: Replace inline script with ConnectionIndicator

- [x] 2.1 Import `ConnectionIndicator` from `../assets/connection-indicator.tsx` and `routes` from `../routes.ts` in `app/ui/webhook-requests-page.tsx`
- [x] 2.2 Remove the inline `<script type="module">` block from the page component
- [x] 2.3 Replace the `<span id="sse-status">Verbunden</span>` badge with `<ConnectionIndicator url={webhookRequestsEventsRoute.href()} reloadMode="window" />` near the page header
- [x] 2.4 Remove unused imports: `getCspNonce` from security-headers (no longer needed since ConnectionIndicator is a compiled asset)

## 3. Verify

- [x] 3.1 Run `npm run typecheck` to verify no type errors
- [x] 3.2 Run `npm test` to verify existing tests pass (724/726 pass, 1 pre-existing failure in app-webhook controller — IPv6/IPv4 callback URL, unrelated)
