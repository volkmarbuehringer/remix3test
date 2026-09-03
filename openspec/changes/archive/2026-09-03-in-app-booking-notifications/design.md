## Context

See proposal.md — Why. The booking-notification pipeline already exists end-to-end except for delivery: four Mastra workflows emit `confirmation`/`cancellation`/`reminder` events through the `NotificationSender` interface, whose only implementation, `consoleNotificationSender`, `console.log`s and returns `{ sent: true }`. This change swaps that stub for an in-app database writer and surfaces the result to the user, reusing the app's existing SSE (`app/utils/sse.ts` `createChannel`) and Remix 3 frame/standalone page patterns. In-app-only delivery was chosen; no email channel.

## Goals / Non-Goals

**Goals:**
- Persist user-scoped `confirmation`/`reminder`/`cancellation` notifications in Postgres.
- Deliver them to the owning user only (privacy), with read-state and an unread count.
- Surface an unread badge in the main nav that updates live via a per-user SSE channel.
- Provide a standalone `/notifications` inbox page.
- Keep the existing `NotificationSender` interface and the 4 workflow call sites unchanged.

**Non-Goals:**
- No email/SMS/third-party delivery yet (explicitly out of scope; `send-email.ts` is untouched).
- No admin→user or other notification types beyond the three booking events.
- No changes to the appointment booking/cancellation business logic itself.

## Decisions

### 1. Per-user SSE scoping is required (security, not preference)
Notifications carry private appointment data, so the channel must be user-scoped. The current `createChannel` holds a single `Set` of controllers and broadcasts to everyone — fine for the generic `invalidate` signals that `appointmentChannel`/`adminChannel` push, but wrong for private data.

- **Chosen:** extend `createChannel` additively — `subscribe(request, key?)` registers controllers under a `Map<key, Set<controller>>`, and `broadcast(event, data?, key?)` enqueues only to matching-key controllers (or all when key omitted). Existing channel call sites keep working (key optional).
- **Alternatives considered:** (a) broadcast globally and filter client-side — rejected, leaks private data over the wire and into other tabs; (b) one channel per feature — rejected, per-user is the correct isolation unit.
- **Auth:** `EventSource` cannot send headers but does send cookies, so the `/notifications/events` controller resolves `getCurrentUser()` and passes `userId` as the key — no user id in the URL, no token plumbing.

### 2. A database sender replaces the console stub
- **Chosen:** implement `dbNotificationSender` (same `NotificationSender` interface) that inserts a notification row and then broadcasts a per-user `new` event. The workflows don't change.
- **Alternatives:** dual db+email — rejected (in-app only this round); keep console as fallback/disable — rejected, goes straight to the real writer.

### 3. Read-state model: per-notification `read_at`
- **Chosen:** nullable `read_at` on each row. Supports an exact unread badge count and both per-item and mark-all-read.
- **Alternative:** a per-user `last_seen_notification_id` watermark (one column, whole-center "seen" semantics) — rejected because it can't express per-item read and complicates the badge count.

### 4. Bell updates in place, not full reload
- **Chosen:** a dedicated `notification-bell.browser.tsx` clientEntry in `MainNav` (server-renders the initial unread count from the DB) subscribes to the per-user channel and bumps the badge from the `new` payload.
- **Alternative:** reuse the `ConnectionIndicator` `invalidate` + reload pattern — rejected as heavier (full page/frame reload on every notification) and noisy.

### 5. Standalone inbox page
`/notifications` mirrors `/settings` (`requireAuth()` middleware + `Layout`), newest-first with pagination via the existing `getPageSize` helper. Each item links to its appointment. `remix.json` `allowFiles` already covers `app/ui/**` and `app/utils/**`, so new client modules need no asset-config change.

### 6. Fix two pre-existing data-shape bugs at the write sites
- Recipient is `String(appt.userId)` — must be parsed back to an integer FK.
- The reminder call site sends only `{recipient,type,appointmentId}`, though its SQL already selects `resource_name/date/title`; pass those so `body`/`title` render.

## Risks / Trade-offs

- **[Extending shared SSE infra]** → keep the key argument optional and additive so `appointmentChannel`/`adminChannel` are untouched; add a browser test asserting cross-user isolation.
- **[Live badge can go stale on a dropped connection]** → recompute the unread count server-side on every nav render and on SSE reconnect, not only on push.
- **[Cron reminder volume]** → index `(user_id, created_at DESC)` plus a partial unread index `(user_id) WHERE read_at IS NULL`.
- **[Notification write must not break the booking]** → wrap the DB insert/queue in a best-effort try/catch that falls back to the existing `enqueueFailedNotification`, exactly like the current payload; the booking outcome is unaffected.
- **[`cancel-user-workflow` also emits `cancellation`]** → confirm it writes a notification row too; it is in scope as one of the three types.

## Migration Plan

1. Add `CREATE TABLE IF NOT EXISTS notifications (...)` to `db/schema.sql` (fresh DBs) and a mirroring `table({ name: 'notifications', ... })` model in `app/data/schema.ts`.
2. Add a one-shot `db/manual-migrations/2026-xx-in-app-notifications.sql` (`BEGIN; CREATE TABLE ...; CREATE INDEX ...; COMMIT;`) for existing databases, applied via `psql "$DATABASE_URL" -f ...`.
3. Deploy code after the migration. **Rollback:** `DROP TABLE IF EXISTS notifications;` — notifications are non-critical, and the app degrades to "no inbox" rather than failing the booking flow.

## Open Questions

- Should opening the inbox auto-mark items read, or is explicit mark-read / mark-all-read sufficient? (Deferrable; doesn't change specs or tasks materially.)
- Default page size for the notifications list (existing `getPageSize` default is 15). (Deferrable.)
