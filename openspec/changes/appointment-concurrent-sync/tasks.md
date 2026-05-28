## 1. SSE Channel Setup

- [x] 1.1 Create `app/lib/appointments-sse.ts` — export `appointmentChannel = createChannel<{invalidate: void}>()` following the same pattern as `messages-sse.ts`
- [x] 1.2 Add an SSE route `/appointment/events` that returns `appointmentChannel.subscribe(request)`

## 2. Error Handling — Collision Detection

- [x] 2.1 Add `AppointmentCollisionError` class to `app/data/appointments.ts` (extends `AppointmentError` with status 409)
- [x] 2.2 In `createAppointment`, catch PostgreSQL error code `23P01` and throw `AppointmentCollisionError`
- [x] 2.3 In `updateAppointment`, catch PostgreSQL error code `23P01` and throw `AppointmentCollisionError`

## 3. Controller — Collision Responses

- [x] 3.1 In `appointment-controller.tsx` `create` action: catch `AppointmentCollisionError`, return 409 with `{ error: "Time slot already taken.", code: "collision" }`
- [x] 3.2 In `appointment-controller.tsx` `update` action: catch `AppointmentCollisionError`, return 409 with `{ error: "Time slot already taken.", code: "collision" }`

## 4. Controller — SSE Broadcasts

- [x] 4.1 In `appointment-controller.tsx` `create` action: import `appointmentChannel` and broadcast `'invalidate'` on success
- [x] 4.2 In `appointment-controller.tsx` `update` action: broadcast `'invalidate'` on success
- [x] 4.3 In `appointment-controller.tsx` `destroy` action: import `appointmentChannel` and broadcast `'invalidate'` on success

## 5. Client-Side — Collision and SSE Handling

- [x] 5.1 In `appointment-grid.tsx`: after create/update fails with 409 `code: "collision"`, call `window.location.reload()`
- [x] 5.2 In `appointment-page.tsx`: add an SSE `<Frame>` or script that subscribes to `/appointment/events` and reloads the page on `invalidate` events
- [x] 5.3 In the SSE reload handler: skip reload if user is actively dragging or editing (check `activeGesture` or `editingId`)

## 6. Validation

- [x] 6.1 Run `npm test` to verify all tests pass
- [x] 6.2 Run `npm run typecheck` to verify types