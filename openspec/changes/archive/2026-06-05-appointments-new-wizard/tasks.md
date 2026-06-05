## 1. Data Layer — Offering Queries

- [x] 1.1 Add `listDaysWithOfferings(db, resourceId, startDate, endDate)` to `appointofferings.ts` — returns distinct days with their offering ranges for a resource in a date window
- [x] 1.2 Add `computeFullHourSlots(offerings)` utility to `appointofferings.ts` — takes offering `during` ranges for a day, returns array of valid full-hour `start_min` values

## 2. Controller — Wizard Routing

- [x] 2.1 Add step-aware rendering to `create` action in `appointments-new/controller.tsx`: read `step` from form data, route to step 1/2/3 renderers, carry forward selections as hidden inputs
- [x] 2.2 Add GET handling for wizard state restoration from URL params (`step`, `resource_id`, `day`)
- [x] 2.3 Implement step 1 handler: validate resource selection, load days with offerings, render step 2
- [x] 2.4 Implement step 2 handler: validate day+resource, load full-hour slots, render step 3
- [x] 2.5 Implement back navigation: step 2 → step 1, step 3 → step 2 with preserved selections
- [x] 2.6 Update edit action to filter time dropdown by resource+date offerings using `computeFullHourSlots`
- [x] 2.7 Remove `resource_id` early validation and `isSlotBookable` pre-check from create/update actions (wizard ensures validity, move check to final validation)

## 3. UI — Wizard Components

- [x] 3.1 Create `appointments-new-wizard-step1.tsx` — resource dropdown + "Weiter" submit button
- [x] 3.2 Create `appointments-new-wizard-step2.tsx` — day radio list grouped by period, period filter buttons, "Weiter" + "Zurück"
- [x] 3.3 Create `appointments-new-wizard-step3.tsx` — filtered full-hour time dropdown (+ gap separator), title input, "Anlegen" + "Zurück"
- [x] 3.4 Update `appointments-new-create-page.tsx` to render wizard step components based on step prop
- [x] 3.5 Update `appointments-new-form.tsx` to render filtered time dropdown in edit mode
- [x] 3.6 Remove `START_MIN_OPTIONS` constant from `appointments-new-form.tsx` (93 options)

## 4. Cleanup & Tests

- [x] 4.1 Update existing appointment grid tests that rely on 15-min `START_MIN_OPTIONS` to work with full-hour filtering
- [x] 4.2 Add tests for `computeFullHourSlots`: single offering, multiple offerings with gap, empty offerings
- [x] 4.3 Add tests for `listDaysWithOfferings`: resource with some days having offerings, no offerings in period
- [ ] 4.4 Add integration tests for wizard flow: step progression, back navigation, final creation
