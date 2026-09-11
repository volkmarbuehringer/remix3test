## Why

`/admin/chatlog` can read a saved conversation but cannot resume it: it is a dead end. An admin who finds the right support conversation still has to copy its context into a fresh `/admin/support-agent` chat, and the list mixes ~300 threads from every resource (customer threads, retired-route placeholders) with no owner, source, message count, or last-activity signal to locate the right one. This change makes a specific saved support conversation openable and continuable in the chat surface, and makes the right conversation findable in the first place.

## What Changes

- Add a `?threadId=` entry contract to `/admin/support-agent`: the index action parses and validates the id format (`validateThreadId`) and the admin's ownership, then server-renders the existing transcript so the chat is not empty before the first new turn.
- Treat an unknown, foreign, or malformed `threadId` as an empty conversation rather than an error (degrade, never fail the page).
- Adopt the resumed thread in the support-agent stream client from the server-rendered `data-thread-id`, with the URL authoritative over captured closure state — mirroring the `/chat?new=1` fix in f2c59a5.
- Add an "Im Chat fortsetzen" action to the chatlog transcript pane for conversations owned by the current admin. It crosses frames, so it uses `data-rmx-document` for a real document navigation instead of a frame swap.
- Classify every chatlog thread by source derived from `resourceId` (`support` = current admin's own, `customer` = another numeric resource, `legacy` = non-numeric placeholder), and show a source label, a message count, and a last-activity ("Letzte Nachricht") column.
- Add a source filter bar (Alle / Support / Kunden / Sonstige) with per-source counts. Because Mastra's `listThreads` only supports an exact `resourceId` filter, filtering is backed by a bounded full-thread sweep.
- Persist the active source filter across pagination, transcript open/dismiss, and delete redirects.
- Customer threads remain read-only. There is no admin takeover path that writes turns into a customer's conversation; that decision is recorded in `design.md` and confirmed with the product owner before implementation.

## Capabilities

### New Capabilities

- `admin-chatlog`: the master–detail chatlog page's thread classification, source filter, per-thread metadata (source, message count, last activity), and the "Im Chat fortsetzen" linkage to the support agent.
- `support-agent-conversation`: the support agent's `?threadId=` entry contract — server-side format/ownership validation, server-rendered transcript, and client-side thread adoption with URL authority.

### Modified Capabilities

- _(none — no existing spec's requirements change. `customer-chat`, `admin-agent-routes`, and `support-agent-frame-layout` keep their current contracts; customer threads stay read-only.)_

## Impact

- Support agent: `app/actions/support-agent/controller.tsx`, `app/ui/support-agent-page.tsx`, `app/assets/streams/public/support-agent-stream.tsx`
- Chatlog: `app/actions/admin/chatlog/controller.tsx`, `app/ui/admin-chatlog-page.tsx`, `app/ui/admin-fragments/chatlog-detail-fragment.tsx`
- New data module: `app/data/chatlog-sources.ts` (classifier moved from `tmp/wip-chatlog-source-filter/chatlog-sources.ts`)
- Memory layer: `app/utils/mastra-memory.ts` gains thread `resourceId`, message count, a bounded full sweep, and a single-thread lookup
- Tests: `app/actions/support-agent/controller.test.ts`, `app/actions/admin/admin-chatlog.test.ts`, `app/actions/admin/admin-chatlog-fragments.test.ts`, `app/assets/streams/streams.test.browser.tsx`
- No database schema change, no backfill, no new route, no change to customer `/chat`
