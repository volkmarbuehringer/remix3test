## 1. Schema & Types

- [x] 1.1 Add `resources` table definition to `app/data/schema.ts` with columns: `id`, `description`, `created_at`, `updated_at`
- [x] 1.2 Add `resource_id` (integer, NOT NULL) column to `appointments` table definition in `app/data/schema.ts`
- [x] 1.3 Add `resource_id` to the `validate` handler in appointments (required on create)
- [x] 1.4 Add `resource_id` to the `afterRead` handler in appointments (parse string to int)
- [x] 1.5 Export `Resource` type from `app/data/schema.ts`

## 2. Database Setup (setup.ts)

- [x] 2.1 Add `resources` CREATE TABLE statement in `setup.ts`
- [x] 2.2 Drop and recreate `appointments` table with `resource_id` column and updated exclusion constraint (truncates existing data)
- [x] 2.3 Add seed logic: insert "resource1" into resources table when empty
- [x] 2.4 Import `resources` table definition in `setup.ts`

## 3. Resource Data Access

- [x] 3.1 Create `app/data/resources.ts` with `ResourceInput` interface and `listResources()` function

## 4. Appointment Data Layer Updates

- [x] 4.1 Add `resource_id` to `AppointmentInput` and `AppointmentUpdate` interfaces in `app/data/appointments.ts`
- [x] 4.2 Update `createAppointment()` to accept and pass required `resource_id`
- [x] 4.3 Update `updateAppointment()` to accept and pass `resource_id`
- [x] 4.4 Update `listAppointmentsByWeek()` to accept optional `resourceId` filter

## 5. Appointment Controller Updates

- [x] 5.1 Update `appointment-controller.tsx` `createSchema` to include required `resource_id`
- [x] 5.2 Update `appointment-controller.tsx` `updateSchema` to include `resource_id`
- [x] 5.3 Pass `resource_id` through create and update handlers
- [x] 5.4 Add `resource_id` query param filtering to the index handler
- [x] 5.5 Fetch resources list and pass to `AppointmentPage`

## 6. Schedule Layout Updates

- [x] 6.1 Add `resource_id` field (number) to `AppointmentLayoutBlock` interface in `app/ui/schedule-layout.ts`

## 7. UI: Appointment Page & Sidebar

- [x] 7.1 Update `AppointmentPageProps` in `app/ui/appointment-page.tsx` to include `resources` array
- [x] 7.2 Add resource dropdown `select` element to `appointment-sidebar.tsx` with onChange navigation
- [x] 7.3 Update sidebar data reading to include resource_id from the JSON data

## 8. Appointment Grid Updates

- [x] 8.1 Update `appointment-grid.tsx` to include `resource_id` on appointment blocks in fetch/patch/delete requests
- [x] 8.2 Update the grid's internal state to carry `resource_id` through drag/resize/create operations

## 9. Type Check & Verification

- [x] 9.1 Run `pnpm run typecheck` and fix any type errors
- [x] 9.2 Run `pnpm test` and fix any failing tests (appointment-grid tests now pass; 3 pre-existing parallel-worker race conditions remain)
- [x] 9.3 Verify the app starts and the appointment page loads with the resource dropdown
