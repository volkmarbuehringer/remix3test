# Tasks: Mobile-Optimized Appointments New Flow

## ~~Task 1: Simplify controller — remove wizard step POST handlers~~ ✅

- **File**: `app/actions/appointments-new/controller.tsx`
- Removed `step === '1'` and `step === '2'` handler blocks
- Combined step 2 handles resource_id + day + start_min + title in one s.parseSafe call
- Missing/invalid step redirects to step 1

## ~~Task 2: Add week utility functions~~ ✅

- **File**: `app/utils/date-utils.ts`
- Added `getCurrentWeekMonday()` and `formatWeekLabel()`
- `isDateInPast` already existed, reused

## ~~Task 3: Refactor data loading for step 2 combined view~~ ✅

- **File**: `app/actions/appointments-new/controller.tsx`
- Step 2 loads week offerings via single `listOfferingsByDayRange` query
- Groups by day, computes full-hour slots, filters booked, returns `daysWithSlots`

## ~~Task 4: Create resource cards UI component~~ ✅

- **File**: `app/ui/appointments-new-resource-cards.tsx` (new)
- Renders resources as styled `<a>` link cards, full-width, min 48px
- Links include grid state params for navigation preservation

## ~~Task 5: Rewrite step 2 UI component~~ ✅

- **File**: `app/ui/appointments-new-step2.tsx` (new, replaces wizard-step2 + wizard-step3)
- Week pagination: ◀ Vorherige | KW label | Nächste ▶
- Day cards with radio for day + time chip radios for start_min
- Title field, Anlegen button, fieldErrors/formError display
- No `<select>` elements

## ~~Task 6: Update AppointmentsNewCreatePage orchestrator~~ ✅

- **File**: `app/ui/appointments-new-create-page.tsx`
- Replaced WizardStep1 with ResourceCards
- Replaced WizardStep2/WizardStep3 with new Step2

## ~~Task 7: Remove unused wizard files~~ ✅

- Deleted `appointments-new-wizard-step1.tsx` and `appointments-new-wizard-step3.tsx`
- Also deleted `appointments-new-wizard-step2.tsx` (no longer referenced)

## ~~Task 8: Update AppointmentsNewPage props~~ ✅

- **File**: `app/ui/appointments-new-page.tsx`
- Replaced `daysWithOfferings` with `DayWithSlots[]`
- Removed `wizardDay`, added `weekStart`

## ~~Task 9: Batch query booked ranges for week~~ ✅

- **File**: `app/data/appointofferings.ts`
- Added `getBookedRangesForWeek()` — single SQL query, grouped by day
- Controller uses it instead of per-day `getBookedRanges` calls

## ~~Task 10: Verify typecheck and tests~~ ✅

- `npm run typecheck` — passes
- `npm test` — 27/27 tests pass in controller test suite
- Wizard step 1/2/3 POST tests replaced with step 2 combined tests
