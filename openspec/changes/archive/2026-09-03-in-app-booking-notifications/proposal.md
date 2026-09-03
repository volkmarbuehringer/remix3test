## Why

Booking notifications are architected but never delivered. Every confirmation, cancellation, and reminder event routes through `consoleNotificationSender` (`app/actions/mastra/notifications/sender.ts`), which only `console.log`s and returns `{ sent: true }` — so a customer who books, reschedules, or cancels an appointment receives nothing. The surrounding plumbing is already built: four Mastra workflows emit these events, a failed-notification retry queue exists, and the app already has real email plus SSE infrastructure. Only the user-visible delivery channel is missing, and it is the core product surface.

## What Changes

- Introduce a persisted, user-scoped `notifications` table with three types for now: `confirmation`, `reminder`, `cancellation`. Each row carries `user_id`, `type`, `title`, `body`, `appointment_id`, `read_at`, `created_at`.
- Replace the `consoleNotificationSender` stub with an in-app database sender that writes notifications, leaving the existing `NotificationSender` interface and the workflow call sites intact.
- Extend the SSE channel infrastructure (`app/utils/sse.ts`) to support **per-user scoped** broadcasts. Notifications carry private appointment data, so — unlike the global `appointmentChannel`/`adminChannel` `invalidate` signals — they must be delivered only to the intended user.
- Add a global bell + unread badge in the main navigation (`MainNav`), surfaced live over the per-user channel.
- Add a new standalone `/notifications` page (auth-required, mirroring `/settings`) listing the current user's notifications, with per-item read and mark-all-read, and links through to the related appointment.

## Capabilities

### New Capabilities
- `booking-notifications`: In-app delivery of appointment confirmation, reminder, and cancellation notifications, with user-scoped storage, read-state, live unread surfacing (bell badge), and a user-facing inbox.

### Modified Capabilities
- *(none)* — this is an additive capability; no existing spec's requirements change.

## Impact

- **Data**: `db/schema.sql` (fresh-bootstrap `CREATE TABLE IF NOT EXISTS notifications`), `app/data/schema.ts` (table model mirroring `users`/`messages`/`lists`), a new one-shot file in `db/manual-migrations/` for existing databases.
- **SSE infra**: `app/utils/sse.ts` (`createChannel` — per-user `subscribe(request, key?)` / `broadcast(event, data?, key?)`), a new `app/utils/notifications-sse.ts`.
- **Workflows (writers)**: `app/actions/mastra/workflows/customer-booking-workflow.ts`, `booking-cancellation-workflow.ts`, `booking-reminder-workflow.ts`, `cancel-user-workflow.ts`; and `app/actions/mastra/notifications/sender.ts` (stub → DB sender). The reminder call site currently drops its payload (title/date/resource) and stringifies the recipient; both need fixing so rows render correctly.
- **Routes/controllers**: `app/routes.ts`, `app/router.ts`, new `app/actions/notifications/controller.tsx`.
- **UI**: new `app/ui/notifications-page.tsx`, `app/ui/notification-bell.browser.tsx`; edited `app/ui/main-nav.tsx` (render bell + server-side unread count).
- **Tests**: notification controller + browser (bell/live-badge) tests added to the existing Playwright suite.
