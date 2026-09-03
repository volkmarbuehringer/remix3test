## 1. Data Layer

- [x] 1.1 Add `CREATE TABLE IF NOT EXISTS notifications (...)` to `db/schema.sql` (idempotent bootstrap) and verify a fresh database boot creates the table with the expected columns (`user_id`, `type`, `title`, `body`, `appointment_id`, `read_at`, `created_at`) and indexes.
- [x] 1.2 Add the mirroring `table({ name: 'notifications', ... })` model to `app/data/schema.ts` and verify `npm run typecheck` passes and the model round-trips a row in a unit test.
- [x] 1.3 Add `db/manual-migrations/2026-xx-in-app-notifications.sql` (`BEGIN; CREATE TABLE ...; CREATE INDEX ...; COMMIT;`) and verify `psql "$DATABASE_URL" -f ...` applies cleanly to an existing database (idempotent re-run is a no-op).
- [x] 1.4 Add data-access helpers (`createNotification`, `listUserNotifications`, `listUnread`, `unreadCount`, `markRead`, `markAllRead`) and verify with unit tests covering create/list/count/read-state.

## 2. Per-User SSE Channel

- [x] 2.1 Extend `createChannel` in `app/utils/sse.ts` additively: `subscribe(request, key?)` registers controllers under a per-key map, `broadcast(event, data?, key?)` targets only the matching key (or all when key omitted) and verify existing `appointmentChannel`/`adminChannel` call sites still broadcast to all subscribers (existing channel tests pass).
- [x] 2.2 Add `app/utils/notifications-sse.ts` (typed per-user channel, `new` event with a notification payload) and verify it compiles and routes through `createChannel`.
- [x] 2.3 Add a browser test asserting cross-user isolation: a `new` event broadcast for user A is NOT received by user B's subscription. Verify it passes.

## 3. Writer / Workflow Integration

- [x] 3.1 Implement `dbNotificationSender` (implements the existing `NotificationSender` interface) that inserts a notification row and broadcasts a per-user `new` event, and verify a single `send()` produces exactly one row plus one broadcast (unit test with a stubbed channel).
- [x] 3.2 Swap `consoleNotificationSender` for `dbNotificationSender` at all four workflow call sites (`customer-booking-workflow`, `booking-cancellation-workflow`, `cancel-user-workflow`, `booking-reminder-workflow`) and verify each still records `notificationSent` as today (existing workflow tests pass).
- [x] 3.3 Fix the write-site data shape: parse the stringified recipient back to a numeric user id (`parseId`/`parseInt`), and enrich the reminder call site so `title`/`date`/`resourceName` (already selected by its SQL) are passed to the sender. Verify rows render with real title/body via a unit test.
- [x] 3.4 Confirm `cancel-user-workflow` produces a `cancellation` row too and verify a test asserts the three types (`confirmation`, `reminder`, `cancellation`) all land in the table.
- [x] 3.5 Wrap the DB insert/broadcast best-effort so a throwing sender falls back to `enqueueFailedNotification` and never fails the booking; verify with a test that forces the sender to throw and asserts the booking result is still success.

## 4. Routes / Controller

- [x] 4.1 Add `notifications` routes to `app/routes.ts` (`index`, `events`, `markRead`, `markAllRead`) and map them in `app/router.ts` with `requireAuth`; verify `npm run typecheck` passes and the routes resolve.
- [x] 4.2 Implement `app/actions/notifications/controller.tsx`: inbox list (newest-first, `getPageSize` pagination), unread-count, mark-read, mark-all-read, and the SSE `events` action that resolves `getCurrentUser()` and subscribes with `userId`. Verify with controller tests for list/pagination/read/unauth-redirect.
- [x] 4.3 Enforce user-scoping in every read/write path (a user may only see/read their own notifications) and verify a cross-user request is denied (controller + browser test).

## 5. UI

- [x] 5.1 Build `app/ui/notifications-page.tsx` inbox list (type badge, title/body, timestamp, per-item mark-read, mark-all-read, link to related appointment) and verify it renders from the controller in a render test.
- [x] 5.2 Build `app/ui/notification-bell.browser.tsx` clientEntry that subscribes to the per-user channel and updates the unread badge from the `new` payload; render it in `MainNav` alongside a server-side initial unread count. Verify in a browser test that a pushed `new` event bumps the badge without a full reload.
- [x] 5.3 Verify the bell shows no active badge when the unread count is zero (browser test).

## 6. Integration / Verification

- [x] 6.1 Run `npm run typecheck` and `npm run lint` and verify both are clean (theme conformance included).
- [x] 6.2 Run the full `npm test` suite and verify notification controller + browser tests and all existing 1300+ tests pass with no regressions.
- [x] 6.3 Update `README.md` feature overview to mention the notification center and verify the doc edit is reflected in the file.
