## Context

The `/appointments/new` create form currently renders all fields at once: resource dropdown, title input, date input, and 93 time-slot options (15-min granularity). The user has no feedback about which slots are bookable until they submit and get an error. All appointment durations are fixed at 1 hour.

The `appointofferings` table defines per-resource-per-day available time ranges (e.g., `[480,1080)` = 8:00–18:00). The appointment calendar at `/appointment` already uses this data for grid rendering, but the new-form page does not.

## Goals / Non-Goals

**Goals:**

- 3-step wizard for creating appointments: (1) resource, (2) day, (3) time + title
- Full-hour granularity only (drop 15-min increments)
- Pure server-rendered HTML — no client JS required for wizard flow
- Period filter buttons (this week, next week, etc.) scope the day list in step 2
- Hide unavailable time slots — dropdown shows only full-hour starts that fall within offerings
- Edit mode filters time dropdown by current resource+date (no wizard)
- Back navigation between wizard steps preserves prior selections
- Existing appointment table, pagination, sort, and period filter remain unchanged

**Non-Goals:**

- No client JS for cascading dropdowns (server-rendered POST cycle)
- No change to appointment duration (still fixed 1 hour)
- No change to schema or routes
- No real-time offering updates mid-wizard (re-validated on final submit)

## Decisions

### Decision 1: Wizard step tracked via hidden form input + URL query param

**Choice**: Step is tracked as a hidden `<input name="step" value="2">` in each POST form. The URL `?creating=true&step=2&resource_id=3` also carries the step for initial load and back-button support.

**Rationale**: Hidden inputs carry state through POST naturally. URL params allow the controller to restore wizard state on GET (back button, bookmark, refresh).

**Alternatives considered**: Session state — rejected because it creates server-side state without need. Multi-route wizard — rejected because it's more routing overhead for no benefit.

### Decision 2: Full-hour slots computed server-side from offering ranges

**Choice**: For a given resource+day, query `appointoffering` WHERE `resource_id=$1 AND day=$2`. Parse each `during` range `[start,end)`, generate all `start_min` values that are multiples of 60 and satisfy `start ≤ start_min < end` and `start_min + 60 ≤ end`.

**Rationale**: The offering data already defines bookable ranges. Full hours are simply a different step size applied to the same ranges. No new data structures needed.

**Example**: Offering `[480,1080)` → `start_min` options: 480, 540, 600, 660, 720, 780, 840, 900, 960, 1020 (10 options vs 24 in the raw 0–23 hour range)

### Decision 3: Step 2 fetches distinct days with offerings for a resource+period window

**Choice**: Query `SELECT DISTINCT day FROM appointoffering WHERE resource_id=$1 AND day >= $periodStart AND day < $periodEnd ORDER BY day`. Display each day with its offering time ranges as subtitle text.

**Rationale**: Existing `getPeriodRange()` and `listOfferingsByDayRange()` already handle the period → epoch bounds conversion. The DISTINCT day query is a minor new query that filters at the database level.

### Decision 4: Edit mode skips wizard, filters time dropdown directly

**Choice**: When `editing` is set, step is not shown. The time dropdown uses the existing `resource_id` + `date` from the row being edited to query offerings and generate filtered full-hour options.

**Rationale**: Edit already has resource+date set. A wizard would add friction. The filtering follows the same server-side logic as step 3 but is applied inline on the existing form.

## Risks / Trade-offs

- **Stale offering data between steps**: Between step 2 and step 3, offerings could be modified by an admin. Mitigation: step 3 validates offerings again and the final POST re-checks `isSlotBookable()`, which is the authoritative check.
- **Large number of days**: If a resource has offerings for every day over 3 months, the day list in step 2 could be long. Mitigation: period filter defaults to "this week" with user-controlled expansion.
- **Offering gaps same-day**: Two offerings `[480,720)` and `[780,1080)` create a visible gap in the time dropdown (no 12:00 option). This is correct behavior and clearly communicates unbookable hours.
