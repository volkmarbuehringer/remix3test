# URL-Param-Driven SQL Filter Checklist

## What This Covers

The touchpoint checklist for adding a new URL-query-param filter (e.g. `?status=pending`) that drives a SQL `WHERE` clause across a controller, its UI, forms, and wizard steps. Read this when adding or extending a grid/table filter, or when an active filter tab resets to the default view.

## Touchpoint Checklist

Adding a new URL-query-param filter that drives a SQL `WHERE` clause requires touching 8+ places across the controller, UI, forms, and wizard steps. Follow this in order.

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
- For segmented tab links, see the active filter-tab note below — don't omit the active tab's param just because it is active
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

## Active Filter-Tab Self-Links Must Not Drop the Active Param

When the segmented filter UI (e.g. period/status tabs) encodes the default filter by omitting a query param, do not generate the active tab's href with the same omission. Omitting the param is only correct when the tab's value actually equals the route's default (e.g. `pending`), not merely because the tab is active. `?status=all` may be the active tab, but dropping `status=all` navigates back to the default view.

Buggy pattern:

```ts
if (!active) params.set('status', value)   // WRONG: 'active' is not the same as 'is the default value'
```

Correct pattern (keep the param unless the value is the true default):

```ts
// Keep `status` unless this is the neutral default (pending) view.
if (!(value === 'pending' && (!status || status === 'pending'))) {
  params.set('status', value)
}
```

**Rule of thumb:** the default representation must be keyed off the default value, not the active state. When adding a new non-default tab (e.g. `all`/`Alle`), re-check the shared active-tab href logic or the new tab will ship this bug.
