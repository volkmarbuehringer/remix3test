## 1. Route & Controller Setup

- [x] 1.1 Add `events: get('/events')` route to the admin appointments route definition in `app/routes.ts`
- [x] 1.2 Import `appointmentChannel` from `../lib/appointments-sse.ts` in `admin-appointments-controller.tsx`

## 2. SSE Events Endpoint

- [x] 2.1 Add `events` action to the admin appointments controller that returns `appointmentChannel.subscribe(context.request)`

## 3. Mutation Broadcasting

- [x] 3.1 Add `appointmentChannel.broadcast('invalidate')` after successful creation in the admin controller's `create` action (before the redirect)
- [x] 3.2 Add `appointmentChannel.broadcast('invalidate')` after successful update in the admin controller's `update` action (before the redirect)
- [x] 3.3 Add `appointmentChannel.broadcast('invalidate')` after successful deletion in the admin controller's `destroy` action (before the redirect)

## 4. Client-Side SSE Subscription

- [x] 4.1 Remove the `<script>` tag from `AdminAppointmentsPage` (inline scripts don't execute inside Frame content)
- [x] 4.2 Add SSE subscription to `AdminAppointmentsContextMenu` clientEntry (reliable client-side execution)
- [x] 4.3 Listen for `invalidate` event, check `URLSearchParams` for `editing`/`creating` before reloading
- [x] 4.4 Close the EventSource on clientEntry unmount (handle.signal abort)

## 5. Validation & Tests

- [x] 5.1 Verify no TypeScript errors: run `npm run typecheck`
- [x] 5.2 Verify existing tests still pass: run `npm test`
- [x] 5.3 Manual verification: open both `/appointments` and `/admin/appointments`, create an appointment in one, verify both pages reload
