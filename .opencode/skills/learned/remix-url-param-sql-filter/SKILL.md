---
name: remix-url-param-sql-filter
description: "Complete touchpoint checklist for adding a URL-param-driven SQL filter to a Remix 3 controller"
user-invocable: false
origin: auto-extracted
---

# Remix 3: URL-Param-Driven SQL Filter — Touchpoint Checklist

**Extracted:** 2026-06-09
**Context:** Adding a `status` filter (pending/expired appointments) to `/appointments/new` in a Remix 3 app using `createController`, wizard forms, and grid state preservation.

## Problem

Adding a new URL-query-param filter (e.g., `?status=pending`) that drives a SQL `WHERE` clause requires touching 8+ places across the controller, UI, forms, and wizard steps. Missing any one causes the filter to silently drop on POST errors, navigation, or form submissions.

## Solution

Follow this touchpoint checklist in order:

### 1. GridState utility (`app/utils/grid-state.ts`)
- Add field to `GridState` interface
- Add reader in `gridStateFromURL`, `gridStateFromForm`, `gridStateFromFormData`
- Add writer in `gridStateToParams`
- Add accessor helper (`gridStateStatus()` pattern)

### 2. Controller — data layer (`app/actions/<route>/controller.tsx`)
- Import the gridState accessor
- Add field to data interface (`status?: string` in `AppointmentsNewPageData`)
- Add field to `load*PageData()` overrides `Pick<>` type
- Read from URL: `let val = overrides?.val ?? (context.url.searchParams.get('val') || undefined)`
- Add SQL `WHERE` clause (parameterized, after period/other filters)
- Return field in data object

### 3. Controller — render function
- Pass `val={data.val}` to the page component

### 4. Controller — thread through all action override calls
Every `load*PageData()` call with overrides needs `val: gridStateVal(gridValues)` — especially POST error paths where `context.url.searchParams` is empty. Check all:
- Rate limit errors
- Validation errors  
- Past date / business rule errors
- Exclusion constraint errors
- Not-found errors

Also add to explicit redirect URL params in wizard step transitions:
```
if (gridValues.val) params.set('val', gridValues.val)
```

### 5. UI — page component (`app/ui/<page>.tsx`)
- Add `val?: string` to props interface
- Destructure `val` from handle props
- Update local URL builder functions to accept and pass `val`
- Thread `val` through calls to imported URL builders (`buildSortUrl`, `buildPaginationUrl`, `buildCreateUrl`, `buildEditUrl`, `buildCancelUrl`)
- Add filter UI (button group, select, etc.)
- Add `val` to `GridStateHiddenInputs` state
- Pass `val` to sub-page components (edit, create panels)

### 6. Sub-page components
- **Edit page**: Add to props interface, add to `gridState` object
- **Create page**: Add to props interface, add to `gridState` object

### 7. Form component (`app/ui/<form>.tsx`)
- Destructure `val` from `gridState`
- Pass `val` to `buildCancelUrl()`

### 8. Wizard step components (if applicable)
- Add `_val` hidden input to each step's form
- Update local URL builder functions (`buildPeriodUrl`, `buildBackUrl`) to pass `gridState.val`
- Update "Abbrechen" links to use `buildCancelUrl` with `val` instead of bare base URL
- Import `buildCancelUrl` from `./mixins/admin-urls.ts`

### 9. Tests
- Test: default behavior (no param)
- Test: param set to each valid value
- Test: param filters correctly (verify content present/absent)
- For filters that exclude data (e.g., "expired"), insert test data directly via SQL if the controller blocks creation of matching records

## When to Use
When adding a new URL-query-param-driven SQL filter to any Remix 3 `createController` list view that has:
- Multiple action handlers (create, update, destroy) with override calls
- Form submissions via `RestfulForm` with `GridStateHiddenInputs`
- Wizard-style multi-step forms
- Fragment/frame navigation or page-level navigation
