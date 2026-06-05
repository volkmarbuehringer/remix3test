## Why

Users currently guess which time slots are bookable — the start time dropdown shows all 24 full-hour slots regardless of whether they fall within an offering. A booking outside an offering is only caught on submit, forcing a frustrating guess-and-retry loop.

## What Changes

- Replace the flat create form with a 3-step wizard: (1) select resource, (2) select day from days that have offerings, (3) select time + enter title and submit
- Time selection snaps to full hours only (drop 15-min granularity)
- Steps are pure HTML POST — no client JS required for the wizard flow
- Period filter buttons (this week, next week, etc.) are reused in step 2 to scope the day picker
- Edit mode stays single-step but filters the time dropdown based on the current resource+date
- Existing appointment table, pagination, filter, and sort remain unchanged

## Capabilities

### New Capabilities
- `appointment-booking-wizard`: 3-step wizard for creating appointments with offering-aware day and time selection, full-hour granularity

### Modified Capabilities
- `appointments-new-page`: Create form changes from flat layout to 3-step wizard; edit form filters time dropdown by offerings

## Impact

- `app/actions/appointments-new/controller.tsx` — add wizard step routing and state
- `app/ui/appointments-new-form.tsx` — replace with wizard components (or add step rendering)
- `app/ui/appointments-new-create-page.tsx` — changed props (receives step-specific data)
- `app/data/appointofferings.ts` — may need a query for days-with-offerings per resource
- Schema: no changes needed
- Routes: no changes needed (same URL, step tracked via form/query params)
