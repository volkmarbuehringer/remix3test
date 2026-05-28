## 1. Database schema

- [x] 1.1 Add `appointments` table definition to `app/data/schema.ts` with columns: `id`, `user_id`, `title`, `date`, `start_min`, `end_min`, `created_at`, `updated_at`
- [x] 1.2 Add appointment creation and table verification to `app/data/setup.ts`

## 2. Data layer

- [x] 2.1 Create `app/data/appointments.ts` with CRUD functions: `listAppointmentsByWeek`, `createAppointment`, `updateAppointment`, `deleteAppointment`
- [x] 2.2 Export `Appointment` type from schema

## 3. Route and navigation

- [x] 3.1 Add `appointment` route to `app/routes.ts` with index GET + CRUD actions
- [x] 3.2 Import and map appointment route in `app/router.ts`
- [x] 3.3 Add "Appointment" nav item to `app/ui/nav.ts`

## 4. Sidebar UI

- [x] 4.1 Create appointment sidebar component with year dropdown (2026–2030) and week number dropdown
- [x] 4.2 Display computed date range (e.g., "Jun 1 – Jun 7, 2026") in sidebar
- [x] 4.3 Add navigation links (Home, Lists, AI, Logout) to sidebar

## 5. Weekly grid UI — Phase 1 (clientEntry, basic interactions)

- [x] 5.1 Create the weekly grid component with 7 day columns (Mon–Sun) and time slot rows, using `clientEntry()` for client-side interactivity
- [x] 5.2 Render appointment blocks positioned by day, start_min, and end_min
- [x] 5.3 Implement block creation: click empty slot → draft block → type name → blur to commit → POST to server
- [x] 5.4 Implement inline rename: double-click block title → edit text → blur to save → PUT to server
- [x] 5.5 Implement block delete via hover delete button → DELETE to server

## 6. Weekly grid UI — Phase 2 (drag-and-drop, resize)

- [ ] 6.1 Implement drag-and-drop: move blocks across days and times with visual feedback
- [ ] 6.2 Implement resize: drag top/bottom edges to change duration
- [ ] 6.3 Adapt layout solver from Timeboxer for date-based blocks (replace `dayOfWeek` with `date`)

## 7. Appointment controller

- [x] 7.1 Create `app/actions/appointment-controller.tsx` with `requireAuth()` middleware
- [x] 7.2 Implement index action: render page with sidebar + grid for selected week
- [x] 7.3 Implement create action: POST new appointment, return JSON
- [x] 7.4 Implement update action: PUT appointment changes (title, date, start_min, end_min)
- [x] 7.5 Implement delete action: DELETE appointment, return JSON

## 8. Verify

- [x] 8.1 Run `npm run typecheck` to confirm no type errors
- [x] 8.2 Start dev server and confirm `/appointment` renders without errors
