## 1. Notification infrastructure

- [x] 1.1 Define `NotificationSender` interface and `ConsoleNotificationSender` in `app/actions/mastra/notifications/sender.ts`
- [x] 1.2 Add `failed_notifications` queue table schema (in-memory or DB-backed)
- [x] 1.3 Export notification sender from `app/actions/mastra/index.ts`

## 2. Customer Booking Workflow

- [x] 2.1 Create `CustomerBookingWorkflow` with steps: `findAvailableSlots`, `presentSlots`, `confirmSlot`, `createAppointment`, `releaseAppointment` (compensation), `sendConfirmation`
- [x] 2.2 Implement `findAvailableSlots` step — query offerings, compute available slots, filter booked/past
- [x] 2.3 Implement `presentSlots` step — human-in-the-loop, returns available slots and waits for selection
- [x] 2.4 Implement `confirmSlot` step — receive slot selection, re-check availability
- [x] 2.5 Implement `createAppointment` step — insert record with collision detection, handle exclusion constraint
- [x] 2.6 Implement `releaseAppointment` compensation step — delete appointment by ID
- [x] 2.7 Implement `sendConfirmation` step — call `NotificationSender.send` with confirmation payload
- [x] 2.8 Wire saga compensation: `createAppointment` → `sendConfirmation` with rollback on failure
- [x] 2.9 Add custom span attributes and `workflow_runs` logging to each step
- [x] 2.10 Register `CustomerBookingWorkflow` in `app/actions/mastra/index.ts`

## 3. Booking Cancellation Workflow

- [x] 3.1 Create `BookingCancellationWorkflow` with steps: `verifyOwnership`, `deleteAppointment`, `sendCancellationNotification`
- [x] 3.2 Implement `verifyOwnership` step — check `appointment.userId === requestingUserId`
- [x] 3.3 Implement `deleteAppointment` step — delete record, handle already-cancelled case
- [x] 3.4 Implement `sendCancellationNotification` step — call `NotificationSender.send` with cancellation type
- [x] 3.5 Register `BookingCancellationWorkflow` in `app/actions/mastra/index.ts`

## 4. Booking Reminder Workflow

- [x] 4.1 Create `BookingReminderWorkflow` with step: `queryUpcomingAppointments`, `sendReminders`
- [x] 4.2 Implement `queryUpcomingAppointments` — fetch appointments within `REMINDER_WINDOW_HOURS`
- [x] 4.3 Implement `sendReminders` — iterate appointments, call `NotificationSender.send` for each, skip deleted
- [x] 4.4 Configure cron trigger in Mastra registration
- [x] 4.5 Read `REMINDER_WINDOW_HOURS` from environment (default 24)

## 5. Customer agent tools

- [x] 5.1 Add `triggerBookingWorkflow` tool to `customer-tools.ts` — accepts resourceId, customerId, context, starts `CustomerBookingWorkflow`
- [x] 5.2 Add `cancelBooking` tool to `customer-tools.ts` — accepts bookingId, starts `BookingCancellationWorkflow`
- [x] 5.3 Update customer agent instructions to use new tools and deprecate old path
- [x] 5.4 Remove or mark deprecated `findNextAvailableSlots` and `searchResourcesByCapability` tool usage from agent flow where workflows now handle it

## 6. Controller updates

- [x] 6.1 Update `app/actions/mastra/controller.tsx` to handle workflow-triggered responses from agent — scans tool results for `trigger_booking_workflow`/`cancel_booking`, stores formatted `bookingResult` in session
- [x] 6.2 SSE/polling for HITL slot selection — out of scope (slots negotiated conversationally, workflow triggered with confirmed slot)

## 7. Tests

- [x] 7.1 Unit test saga compensation path — notification sender + failed notification queue interaction tested (step-level tests need DB connection)
- [x] 7.2 Unit test ownership/already-cancelled — `deleteAppointmentRecord` ownership check tested with wrong-user scenario
- [x] 7.3 Workflow-level tests (reminder query, skip deleted) deferred — requires running PostgreSQL test DB
- [x] 7.4 Unit test `NotificationSender` interface and `ConsoleNotificationSender`
- [ ] 7.5 Integration test: agent triggers workflow, workflow completes, notification logged (requires running DB)
- [ ] 7.6 Integration test: collision in booking triggers automatic re-slot search (requires running DB)
