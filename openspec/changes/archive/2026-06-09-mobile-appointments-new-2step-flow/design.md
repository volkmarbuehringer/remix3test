# Design: Mobile-Optimized Appointments New Flow

## Overview

The `/appointments/new` page switches from a 3-step POST wizard to a 2-interaction flow: resource card selection → combined day/time/title form. All rendering stays SSR. No client JavaScript.

## Flow Diagram

```
User taps "Neu" button
        │
        ▼
┌─────────────────────────┐
│  STEP 1: Resource Cards  │  ← GET /appointments/new?creating=true
│                         │
│  [Card: Raum 1]  [Card] │  Each card = <a href="...&resource_id=X">
│  [Card: Raum 2]  [Card] │  Tap → immediate navigation
│  [Card: Raum 3]         │
└─────────────────────────┘
        │ tap card
        ▼
┌─────────────────────────┐
│  STEP 2: Day + Time +   │  ← GET /appointments/new?creating=true
│         Title           │       &step=2&resource_id=X
│                         │
│  ◀ Vorherige  KW 25 ▶   │  ← Week pagination via <a> links
│                         │
│  ○ Mo, 09.06.           │  ← Radio for day
│    ○ 09:00 ○ 10:00     │  ← Radio chips for time
│  ○ Di, 10.06.           │
│    ○ 09:00 ○ 11:00     │
│  ○ Mi, 11.06.           │
│    ○ 10:00 ○ 14:00     │
│                         │
│  Titel: [__________]    │
│                         │
│  [Anlegen]  [Abbrechen] │  ← One form POST to create
└─────────────────────────┘
        │ POST with day + start_min + title
        ▼
   Redirect to index
   with editing=X
```

## Route & Controller Changes

### routes.ts — No changes

The existing `appointmentsNew` route already handles all needed paths.

### app/actions/appointments-new/controller.tsx

**`loadAppointmentsNewPageData` modifications:**

1. **Step 1 rendering** — When `creating=true` and no `step` param, show resource cards instead of the old dropdown form. Load resources (same query, cached).

2. **Step 1 → Step 2 navigation** — Removed the POST handler for step 1. Resources are now `<a>` links:
   ```
   ?creating=true&step=2&resource_id=42
   ```

3. **Step 2 data loading** — When `step=2` and `resource_id` set:
   - Read `week_start` from URL (epoch ms for Monday). Default = current week's Monday.
   - Compute range: `week_start` → `week_start + 7 * 86400000`
   - Query `appointoffering` for that range + resource_id (via `listOfferingsByDayRange`)
   - Group by day, compute full-hour slots per day (`computeFullHourSlots`)
   - Query booked ranges for each day (`getBookedRanges`), filter (`filterAvailableSlots`)
   - Return `daysWithSlots: { day: number; slots: number[] }[]`

4. **Step 2 form submission** — Single POST with fields: `resource_id`, `day`, `start_min`, `title`. Validates all in one shot. Creates appointment on success.

5. **Step 1 data** — Compute a short availability summary per resource to show on cards. Can be: earliest upcoming day with offerings, or a simple "available" indicator. Use existing `listOfferingsByDayRange` with a short lookahead (7 days).

### create action changes

- **Remove** `step === '1'` handler (was dropdown POST → redirect to step 2)
- **Remove** `step === '2'` handler (was day radio POST → redirect to step 3)
- **Add** single combined handler: when `step=2`, validate `resource_id` + `day` + `start_min` + `title` together, create appointment, redirect to index with `editing=X`

## Data Loading

### Step 1: Resource cards with availability hint

```
query: SELECT id, description FROM resources ORDER BY description
+ optional: for first 3 resources, peek next 7 days to show "available"
           (defer to tasks decision — can be simple list without hints)
```

### Step 2: Day slots for a week

```typescript
let offerings = await listOfferingsByDayRange(db, weekStart, weekEnd, resourceId)
// Group by day
let dayOfferingMap = groupBy(offerings, o => o.day)
let daysWithSlots = []
for (let [day, dayOfferings] of dayOfferingMap) {
  let ranges = dayOfferings.map(o => parseDuring(o.during)).filter(Boolean)
  let slots = computeFullHourSlots(ranges)
  let booked = await getBookedRanges(db, resourceId, day)
  if (booked.length > 0) slots = filterAvailableSlots(slots, booked)
  daysWithSlots.push({ day, slots })
}
```

Performance: ~1-2 queries per day for booked ranges. Mitigation: batch query all booked ranges for the week in one query.

## UI Components

### New: `appointments-new-resource-cards.tsx`

Renders the resource list as styled `<a>` link cards. Each card:
- Full-width, large touch target (min 48px height)
- Shows resource name
- Background color, border, rounded corners
- Tap → navigate to step 2 with resource_id

Replace `WizardStep1` usage in `AppointmentsNewCreatePage`.

### Modified: `appointments-new-wizard-step2.tsx` → `appointments-new-step2.tsx`

Rename and extend:
- Week pagination bar: ◀ Vorherige | KW label | Nächste ▶
  - All links with `week_start` param
  - "Vorherige" disabled (not a link) when `week_start === currentWeekMonday`
- Day list with embedded time chips:
  - Each day is a card with radio for day + labeled time chip radio buttons
  - Layout: day name + date on left, time chips on right/below
- Title input field at bottom
- "Anlegen" submit button

### Remove

- `appointments-new-wizard-step1.tsx` — no longer needed
- `appointments-new-wizard-step3.tsx` — functionality merged into step2
- `appointments-new-form.tsx` — direct create form no longer used (edit form stays)
- The `<select>` element usage for resource and time selection in the create flow

### Keep

- `appointments-new-edit-page.tsx` — edit mode stays as-is (it's for editing existing appointments, less frequent on mobile)
- `AppointmentsNewForm` — still used for edit mode

## Week Pagination Details

URL format:
```
/appointments/new?creating=true&step=2&resource_id=42&week_start=1750896000000
```

- `week_start` = epoch ms of Monday 00:00:00 UTC for the week
- Default: `getCurrentWeekMonday()` = Monday of current week
- Previous link: `week_start = current - 7 * 86400000` (shown only if > current week Monday)
- Next link: `week_start = current + 7 * 86400000`
- Label: calendar week number, e.g. "KW 25"

```typescript
function getWeekNumber(epochMs: number): number {
  let d = new Date(epochMs)
  // ISO week calculation
  ...
}
```

## Validation (Step 2 Form Submit)

All validated server-side via `s.parseSafe`:
- `resource_id`: required, valid integer
- `day`: required, valid epoch ms, must not be in the past
- `start_min`: required, valid minute-of-day (0-1380), must be in offerings for that day+resource
- `title`: required, non-empty trimmed string
- Plus exclusion constraint check for overlapping appointments

## Rendering on Error

If step 2 form validation fails, re-render step 2 with:
- Same `week_start` and `resource_id` preserved
- `fieldErrors` mapped to specific fields
- `formValues` to repopulate inputs
- `formError` banner for general errors (overlap, rate limit)

## Types

Add to controller.tsx exports:

```typescript
export interface DayWithSlots {
  day: number          // epoch ms
  slots: number[]      // valid start_min values
  ranges: { startMin: number; endMin: number }[]  // offering ranges for display
}

export interface ResourceCard {
  id: string
  description: string
}
```
