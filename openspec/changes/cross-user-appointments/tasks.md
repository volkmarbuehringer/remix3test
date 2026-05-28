## 1. Data Layer

- [ ] 1.1 Add `listAllAppointmentsByWeek(db, weekStart, weekEnd)` to `app/data/appointments.ts` — same query as `listAppointmentsByWeek()` but without the `user_id` filter

## 2. Types & Interfaces

- [ ] 2.1 Add `user_id: number` to the `AppointmentLayoutBlock` interface in `app/ui/schedule-layout.ts`

## 3. Controller

- [ ] 3.1 In `app/actions/appointment-controller.tsx` `index` action: replace `listAppointmentsByWeek` call with `listAllAppointmentsByWeek`; pass `currentUserId` (from `(auth.identity as User).id`) into the `AppointmentPage` props

## 4. Page Component

- [ ] 4.1 In `app/ui/appointment-page.tsx`: add `currentUserId` to the `AppointmentPageProps` interface; include `currentUserId` in the embedded JSON data

## 5. Grid Component — Styling

- [ ] 5.1 Add a `foreignBlockStyle` css() mixin — muted/lighter background, colored left-border accent, `cursor: default`
- [ ] 5.2 Apply `foreignBlockStyle` to blocks where `user_id !== currentUserId` in the grid render

## 6. Grid Component — Interaction Guards

- [ ] 6.1 In `handleBlockPointerDown`: add `appt.user_id !== currentUserId` check — if foreign, return early (blocks drag and double-click edit)
- [ ] 6.2 In resize handle `pointerdown` handlers: add ownership check — if foreign, return early (blocks resize)
- [ ] 6.3 Remove hover effects (highlight, expanded title) for foreign blocks
- [ ] 6.4 Ensure trashcan drop and types-panel drop are also blocked (already covered by drag not starting)

## 7. Layout Solver — Foreign Blocks as Obstacles

- [ ] 7.1 Pass `currentUserId` to `previewMoveBlock()` and `previewResizeBlockTime()` — the solver needs to know which blocks are shiftable
- [ ] 7.2 In the solver's shift functions (`placeBlocksDown`, `placeBlocksUp`, `insertBlock`, `resolvePush`): skip blocks where `user_id !== currentUserId` — never shift foreign blocks
- [ ] 7.3 In `getCollisions` / collision detection: if a proposed placement overlaps a foreign block, prevent the solver from producing a valid layout (return `unresolved: true`)

## 8. Tests

- [ ] 8.1 Run existing tests to verify no regression
- [ ] 8.2 Verify that foreign appointments appear in the grid data
- [ ] 8.3 Verify that update/destroy operations still reject non-owner requests (existing server-side behavior)
