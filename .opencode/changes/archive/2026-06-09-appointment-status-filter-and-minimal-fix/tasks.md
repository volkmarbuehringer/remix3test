# Tasks: Appointment Status Filter & Minimal Screen Fix

## Task 1: Add `status` to controller data layer ✓

**File**: `app/actions/appointments-new/controller.tsx`

- Add `status?: string` to `AppointmentsNewPageData` interface ✓
- Add `status` parameter to `loadAppointmentsNewPageData()` overrides and read from URL ✓
- Add SQL filter for pending/expired status (after period filter block, ~line 145) ✓
- Return `status` in the data object ✓

## Task 2: Thread `status` through all controller actions ✓

**File**: `app/actions/appointments-new/controller.tsx`

- In `index` action: no override needed (reads from URL) ✓
- In `create` action: pass `status: gridStateStatus(gridValues)` to all `loadAppointmentsNewPageData()` calls ✓
- In `update` action: same as create ✓
- In `destroy` action: same via `errorRedirectDestroy` → update that function too ✓
- In `renderAppointmentsNewPage`: pass `data.status` to component ✓

## Task 3: Update URL builder functions in UI ✓

**File**: `app/ui/appointments-new-page.tsx`

- Add `status?: string` parameter to local `buildPeriodUrl()` function ✓
- Add `status?: string` parameter to local `buildEditUrl()` function ✓
- Thread `status` through calls to imported `buildSortUrl`, `buildPaginationUrl`, `buildCreateUrl`, `buildCancelUrl` ✓

## Task 4: Add status filter buttons to UI ✓

**File**: `app/ui/appointments-new-page.tsx`

- Add `status?: string` to `AppointmentsNewPageProps` interface ✓
- Destructure `status` from handle props ✓
- Add a second `<span>` group after period buttons with "Ausstehend" / "Abgelaufen" links ✓
- Follow exact pattern from `app/ui/admin-appointments-page.tsx:192-228` (buttons without `rmx-target`) ✓
- Include `status` in `GridStateHiddenInputs` state and JSON grid state ✓

## Task 5: Fix minimal screen - 2-row filter bar layout ✓

**File**: `app/ui/appointments-new-page.tsx`

Restructure the filter bar to max 2 rows:

- Group 1 (Row 1): period buttons (no `flexWrap: 'wrap'`) + first spacer ✓
- Group 2 (Row 2): status buttons + second spacer + "Neu" button ✓
- Use column direction on the outer container or nested flex containers ✓
- Verify layout renders correctly at various viewport widths ✓

## Task 6: Verify and test ✓

- Run `npm run typecheck` to catch type errors ✓
- Run existing tests to ensure no regressions ✓ (782 pass, 0 fail)
- Manually verify: filter bar layout, status filter switching, URL param persistence ✓
