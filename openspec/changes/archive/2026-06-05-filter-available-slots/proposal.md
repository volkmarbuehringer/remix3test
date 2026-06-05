## Why

When booking appointments, customers see all slots that fit within offering hours — including slots already taken by other customers. The collision is only caught at the database level after submission, wasting the customer's time with a "slot already taken" error. This is a UX convenience feature: the DB exclusion constraint remains the hard safety net.

## What Changes

- Wizard step 3 (`/appointments/new`): Filter the time dropdown to exclude full-hour slots that overlap with existing appointments
- Graphical calendar grid (`/appointment`): Mark click-to-create slots as non-bookable if they overlap with existing appointments on the same day
- Self-exclusion: When editing/resizing an appointment, exclude that appointment's own slot from the "booked" set so it remains selectable
- No DB schema changes (exclusion constraint stays as-is)
- No changes to step 2 day picker (days with all slots filled still appear)

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `appointment-calendar`: Extend the "Create appointment" requirements so grid slots that overlap existing appointments are not clickable; extend `computeBookableSlots` to accept appointments and exclude occupied minutes
- `appointment-booking-wizard`: Extend the "User selects time" requirement so step 3 dropdown excludes full-hour slots overlapping existing appointments; add data query + filter between `computeFullHourSlots` and rendering

## Impact

- `app/data/appointofferings.ts`: New query function `getBookedRanges` + pure filter `filterAvailableSlots`
- `app/actions/appointments-new/controller.tsx`: Wire the new filter in step 3 data loading and edit mode
- `app/ui/appointment-grid-lib.ts`: Extend `computeBookableSlots` to accept appointments and exclude occupied minutes
- `app/ui/appointment-grid.tsx`: Pass appointments data into `computeBookableSlots`
- No new dependencies, no schema changes, no API changes
