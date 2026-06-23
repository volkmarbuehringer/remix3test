## Why

The webhook-requests page uses an inline `<script>` for SSE-driven live refresh, while every other SSE-capable page in the app uses the `ConnectionIndicator` clientEntry component. The inline script is fragile: it lacks lifecycle integration with Remix 3's client runtime, survives Frame navigation poorly, and uses an ad-hoc cache-busting reload (`window.location.href` with `_t` param) instead of the standard reload mechanism.

## What Changes

- Replace the inline `<script type="module">` in `WebhookRequestsPage` with the existing `ConnectionIndicator` clientEntry component
- Add `invalidate` event support to `webhookChannel` broadcasts (in addition to `new_request` and `callback_received`)
- Migrate all three broadcast sites (`webhook`, `app-webhook`, `callback`, and `resend` controllers) to also broadcast `invalidate` for consistency with the standard SSE reload pattern
- Remove the inline script's ad-hoc reload logic in favor of `ConnectionIndicator`'s `reloadMode="window"` behavior

## Capabilities

### New Capabilities

- `webhook-requests-sse`: SSE-driven live refresh for the webhook-requests viewer page, using the standard `ConnectionIndicator` component and `invalidate` event pattern

### Modified Capabilities

- `webhook-requests-viewer`: The "SSE-driven live refresh" requirement changes from inline-script + full-page redirect to clientEntry-based + window reload without cache-busting
- `sse-connection-status`: Add requirement for the `ConnectionIndicator` to support `invalidate` events from the webhook channel (already supports it structurally, but needs validation)

## Impact

- `app/ui/webhook-requests-page.tsx` — remove inline `<script>`, import and use `ConnectionIndicator`
- `app/lib/sse-events.ts` — keep as-is (already defines `new_request` and `callback_received`)
- `app/actions/webhook/controller.tsx` — add `webhookChannel.broadcast('invalidate')` after `broadcast('new_request')`
- `app/actions/app-webhook/controller.tsx` — add `webhookChannel.broadcast('invalidate')` after `broadcast('new_request')`
- `app/actions/callback/controller.tsx` — add `webhookChannel.broadcast('invalidate')` after `broadcast('callback_received')`
- `app/actions/webhook-requests/controller.tsx` — add `webhookChannel.broadcast('invalidate')` after `broadcast('new_request')`
- No new dependencies
