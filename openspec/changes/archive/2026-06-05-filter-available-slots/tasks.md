## 1. Wizard: Server-side slot filtering

- [x] 1.1 Add `getBookedRanges` query function to `app/data/appointofferings.ts` — queries `appointments` for `start_min`, `end_min` where `resource_id=$1 AND date=$2`, with optional `excludeId` parameter
- [x] 1.2 Add `filterAvailableSlots` pure function to `app/data/appointofferings.ts` — takes `fullHourSlots` array and `booked` ranges, returns filtered array using `m < b.endMin && m + 60 > b.startMin` overlap check
- [x] 1.3 Write unit tests for `filterAvailableSlots` in `app/data/appointofferings.test.ts` — verify exact overlap, partial overlap, no overlap, self-exclusion, empty booked, all booked
- [x] 1.4 Wire `getBookedRanges` + `filterAvailableSlots` in `app/actions/appointments-new/controller.tsx` step 3 data loading (lines 205-212) — filter computed slots before passing to wizard
- [x] 1.5 Wire self-exclusion in edit mode (controller.tsx lines 230-242) — pass `editRow.id` to `getBookedRanges`, remove the now-redundant manual slot re-adding logic

## 2. Graphical grid: Client-side slot filtering

- [x] 2.1 Extend `computeBookableSlots` in `app/ui/appointment-grid-lib.ts` — add `appointments` parameter, exclude 15-min sub-slots that overlap with any appointment on the same day using `m < appt.end_min && m + 15 > appt.start_min`
- [x] 2.2 Update `app/ui/appointment-grid.tsx` — pass `data.appointments` to `computeBookableSlots` call
- [x] 2.3 Handle self-exclusion for drag/resize in the grid — exclude the currently-being-edited appointment's range from the appointments list passed to `computeBookableSlots`

## 3. Verification

- [x] 3.1 Run `npm test` — confirm all tests pass (existing + new)
- [x] 3.2 Run `npm run typecheck` — confirm no type errors
- [ ] 3.3 Manual smoke test: create an appointment via grid, verify the occupied slot is not clickable
- [ ] 3.4 Manual smoke test: create an appointment via wizard, verify booked full-hour slot is absent from dropdown
- [ ] 3.5 Manual smoke test: edit an existing appointment, verify its own slot remains selectable
