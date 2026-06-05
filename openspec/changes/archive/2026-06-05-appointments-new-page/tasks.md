## 1. Route Setup

- [x] 1.1 Add `/appointments/new` route tree in `routes.ts` (top-level, parallel to `/appointment`)
- [x] 1.2 Map the new route to the new controller in `router.ts`

## 2. Schema & Utilities

- [x] 2.1 Add `appointmentsNewSaveSchema` to `utils/appointment-schema.ts` — variant without `user_id` field
- [x] 2.2 Export `APPOINTMENTS_NEW_FORM_KEYS` (without `user_id`)

## 3. Controller

- [x] 3.1 Create `actions/appointments-new/controller.tsx` with `requireAuth()` middleware (no `requireAdmin()`)
- [x] 3.2 Implement `index` action — load appointments filtered to `auth.identity.id`, with sort/filter/period/pagination
- [x] 3.3 Implement `create` action — use `auth.identity.id` as `user_id`, validate with new schema, reuse slot-bookable check and exclusion constraint handling
- [x] 3.4 Implement `update` action — same as create but with existing row fetch for edit context
- [x] 3.5 Implement `destroy` action — delete with ownership check (only own appointments)
- [x] 3.6 Wire SSE `events` endpoint via `appointmentChannel`

## 4. UI — Page Component

- [x] 4.1 Create `ui/appointments-new-page.tsx` — simplified table with columns: ID, Titel, Ressource, Datum, Zeit
- [x] 4.2 Add inline action buttons (Bearbeiten/Löschen) per table row
- [x] 4.3 Implement search/filter bar and period presets
- [x] 4.4 Implement column sorting and pagination
- [x] 4.5 Add hidden DELETE forms for Löschen action with grid state preservation

## 5. UI — Form Component

- [x] 5.1 Create `ui/appointments-new-form.tsx` — form without user_id/benutzer field
- [x] 5.2 Create `ui/appointments-new-create-page.tsx` and `ui/appointments-new-edit-page.tsx` wrappers

## 6. Integration

- [ ] 6.1 Verify both `/verwaltung/appointments` and `/appointments/new` work side by side
- [ ] 6.2 Verify new page only shows appointments for the authenticated user
- [ ] 6.3 Verify non-admin users can access `/appointments/new` but not `/verwaltung/appointments`
