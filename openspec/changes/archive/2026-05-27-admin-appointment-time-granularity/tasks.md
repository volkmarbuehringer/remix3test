## 1. Admin Edit Form — Time Dropdowns to 15-min Granularity

- [x] 1.1 In `admin-appointments-edit-page.tsx`: Change `START_MIN_OPTIONS` from 24 hourly values to 96 fifteen-minute values (`Array.from({ length: 96 }, (_, i) => i * 15)`)
- [x] 1.2 In `admin-appointments-edit-page.tsx`: Change `END_MIN_OPTIONS` from 24 hourly values to 96 fifteen-minute values (`Array.from({ length: 96 }, (_, i) => (i + 1) * 15)`)
- [x] 1.3 Verify no other changes needed in edit page — `formatMinOption()` already handles arbitrary minute values correctly

## 2. Admin Create Form — Same Dropdown Update

- [x] 2.1 In `admin-appointments-create-page.tsx`: Change `START_MIN_OPTIONS` to 96 fifteen-minute values
- [x] 2.2 In `admin-appointments-create-page.tsx`: Change `END_MIN_OPTIONS` to 96 fifteen-minute values
- [x] 2.3 Verify default selections (`min === 480` for start, `min === 1020` for end) still match with new options — both values are multiples of 15, so they work unchanged

## 3. Server-side Validation — Accept 15-min Granularity

- [x] 3.1 In `admin-appointments-controller.tsx`: Change `validateAppointmentForm()` — replace `startMin % 60 !== 0` with `startMin % 15 !== 0`
- [x] 3.2 In `admin-appointments-controller.tsx`: Change `validateAppointmentForm()` — replace `endMin % 60 !== 0` with `endMin % 15 !== 0`
- [x] 3.3 Verify min/max bounds unchanged (start 0–1380, end 60–1440)

## 4. Verify

- [x] 4.1 Run typecheck to ensure no type errors
- [x] 4.2 Run full test suite: `pnpm test` — 505/505 pass
