## Why

Newapp has a working but ad-hoc SSE implementation — a single `sseClients` Set in `app/lib/messages-sse.ts` used only for admin message invalidation. This doesn't scale as more features need real-time updates (chat streaming, agent progress, workflow status). Additionally, users have no visibility into whether SSE connections are alive — the admin messages page's SSE runs silently without any connected/disconnected indicator, making it unclear when the page is no longer receiving updates.

We need a generalized SSE infrastructure so every feature can opt into real-time push without duplicating the pattern, and a connection status UI so users know when they're live.

## What Changes

- **Generalized SSE channel system**: Extract a reusable `app/lib/sse.ts` module with a typed `createChannel<EventMap>()` factory that manages subscriber Sets, typed broadcast, automatic cleanup on abort, and heartbeat management. Replace the ad-hoc `sseClients` in `messages-sse.ts` with a channel.
- **SSE subscription endpoint helper**: Provide a `createSubscriptionEndpoint()` utility that produces the `ReadableStream` response with correct headers, heartbeat, and lifecycle cleanup — so any controller can add SSE in ~5 lines.
- **Connection status client component**: A reusable `clientEntry` asset (`ConnectionIndicator`) that renders a connected/disconnected dot with status text, driven by `EventSource` events (`open`, `error`, custom events).
- **Admin messages page upgrade**: Wire the existing admin messages page to use the new SSE channel for invalidation, and add a connection status indicator to the page.
- **Remove ad-hoc pattern**: Deprecate `app/lib/messages-sse.ts` and migrate to the new generalized system.

## Capabilities

### New Capabilities

- `sse-infrastructure`: Typed SSE channel creation, subscriber management, heartbeat, subscription endpoint helper, and a client-side connection status component.
- `sse-connection-status`: Client-side connection indicator showing live/disconnected/reconnecting states via a pulsing dot.

### Modified Capabilities

- _(None — existing specs are about frames and env loading, not SSE)_

## Impact

- **New module**: `app/lib/sse.ts` — the generalized SSE channel + endpoint helper
- **New asset**: `app/assets/connection-indicator.tsx` — client-side connection status component
- **Modified**: `app/lib/messages-sse.ts` — convert to use the new channel; or deprecate and inline via new system
- **Modified**: `app/actions/admin-messages-controller.tsx` — use new helpers for the subscribe endpoint
- **Modified**: `app/ui/admin-messages-page.tsx` — add connection indicator
- **New tests**: `app/lib/sse.test.ts` for the channel module, connection indicator tests
- **Dependencies**: None beyond existing Remix + TypeScript
