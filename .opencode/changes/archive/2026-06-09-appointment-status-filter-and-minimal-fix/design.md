# Design: Appointment Status Filter & Minimal Screen Fix

## Overview

Add a past/pending status filter to `/appointments/new` mirroring the `/verwaltung/appointments` pattern, and restructure the filter bar to stay at 2 rows maximum on narrow viewports.

---

## 1. Controller Changes (`app/actions/appointments-new/controller.tsx`)

### 1.1 Data interface

Add `status?: string` to `AppointmentsNewPageData` (line ~86).

### 1.2 Data loading function

In `loadAppointmentsNewPageData()` (line ~111):

- Read `status` from `context.url.searchParams.get('status')` or from `overrides.status`
- Add `status` to the function signature's `overrides` type
- After the period-range filter block (after line ~145), add the same status-based date filter as the admin controller:

```
if (status === 'pending' || !status) {
  addWhere(`a.date >= $${paramIndex}`)
  params.push(Date.now())
} else if (status === 'expired') {
  addWhere(`a.date < $${paramIndex}`)
  params.push(Date.now())
}
```

Note: Since this controller uses inline parameter counting (unlike the admin controller's `addWhere` wrapper), follow the existing inline style: increment `paramIndex`, append `AND a.date >= $${paramIndex}` or `AND a.date < $${paramIndex}`, push `Date.now()`.

### 1.3 Thread status through all calls

Pass `status` alongside `filter`, `period`, etc. in every call to `loadAppointmentsNewPageData()` from `index`, `create`, `update`, `destroy` actions.

### 1.4 Render function

Pass `data.status` to the `AppointmentsNewPage` component.

---

## 2. UI Changes (`app/ui/appointments-new-page.tsx`)

### 2.1 Props interface

Add `status?: string` to `AppointmentsNewPageProps`.

### 2.2 URL builder functions

- Add `status` parameter to local `buildPeriodUrl()` and `buildEditUrl()` functions
- The imported `buildSortUrl`, `buildPaginationUrl`, `buildCreateUrl` from `admin-urls.ts` already accept `status` — thread it through when calling them

### 2.3 Status filter buttons

Add a second `<span>` group after the period buttons (inside the filter bar), containing two `<a>` links with `<Button>` components for "Ausstehend" and "Abgelaufen", following the exact same pattern as `admin-appointments-page.tsx:192-228` but without `rmx-target` (this page isn't in a frame):

```tsx
<span mix={css({ display: 'inline-flex', alignItems: 'center' })}>
  {(['pending', 'expired'] as const).map((value, i, arr) => {
    let isFirst = i === 0
    let isLast = i === arr.length - 1
    let label = value === 'pending' ? 'Ausstehend' : 'Abgelaufen'
    let active = value === 'pending' ? (!status || status === 'pending') : status === 'expired'
    let params = new URLSearchParams()
    if (offset > 0) params.set('offset', String(offset))
    params.set('sort', sortColumn)
    params.set('order', sortDirection)
    if (filter) params.set('filter', filter)
    if (period) params.set('period', period)
    if (!active) params.set('status', value)
    let href = BASE + '?' + params.toString()
    return (
      <a href={href} mix={css({ ... })}>
        <Button tone={active ? 'primary' : 'secondary'}>{label}</Button>
      </a>
    )
  })}
</span>
```

### 2.4 Destructure and pass through

Destructure `status` from handle props, pass it to URL builders, and include it in `GridStateHiddenInputs`.

---

## 3. Minimal Screen Layout Fix

### Current problem

The filter bar has 3 groups in a `flexWrap: 'wrap'` container:
1. Inner span of 5 period buttons (wraps to 2 rows on narrow)
2. Spacer
3. "Neu" button
→ Total: 3 rows

### After adding status buttons, we'd have:
1. Inner span of 5 period buttons
2. Status buttons span (2 buttons)
3. Spacer
4. "Neu" button

### Solution: 2-row max layout

Restructure the filter bar into exactly 2 rows:

**Row 1**: Period buttons + spacer (no wrap on the period buttons group)
**Row 2**: Status buttons + spacer + "Neu" button

Implementation:
- Remove `flexWrap: 'wrap'` from the outer filter bar container (use a column layout instead with a fixed gap)
- Actually simpler: keep flexWrap and use grouping. Wrap the period buttons + first spacer in one group, and status buttons + second spacer + Neu in another group.
- Better approach: remove `flexWrap: 'wrap'` from the period button inner span so the 5 period buttons stay on one line (even if they overflow/scroll minimally). The spacer + Neu sit on the same row as the period buttons on wide screens.
- On narrow screens, the spacer pushes everything: remove spacer on narrow, or change approach.

Simpler and more robust approach:
- Remove `flexWrap: 'wrap'` from the inner period button container
- Wrap the status buttons + Neu button together in a separate row container
- Use a column-reverse or two-row structure

**Actually cleanest approach**: Change the outer container to a column layout with two rows:
- Row 1: period buttons + spacer (period buttons don't wrap)
- Row 2: status buttons + spacer + Neu

This guarantees exactly 2 rows max regardless of viewport width.

---

## 4. Files Changed

| File | Change |
|------|--------|
| `app/actions/appointments-new/controller.tsx` | Add `status` param, SQL filter, thread through |
| `app/ui/appointments-new-page.tsx` | Add status buttons, fix layout, update URL builders |
