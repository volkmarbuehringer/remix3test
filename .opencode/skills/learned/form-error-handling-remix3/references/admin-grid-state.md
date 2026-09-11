# Admin Grid State Preservation

## What This Covers

Keeping admin CRUD grid state (sort/filter/pagination) across a failed POST, and the error-display rules for the admin frame. Read this when the task involves:

- A shared `loadXxxPageData(context, overrides?)` used by both GET and POST-error renders
- Hidden inputs and `app/utils/grid-state.ts` helpers
- `renderGridFormError` and why the grid error path returns **200, not 400**
- Page-level vs form-level error banners, and avoiding double display
- Unicode escapes in JSX text

For the core validation pattern, see `validation-and-schema.md`. For adding a new filter end-to-end, see `url-param-filter-checklist.md`.

## Admin Forms: Grid State Preservation

Admin CRUD forms often have sort/filter/pagination state that must survive POST error re-renders. Use hidden form inputs + a shared `loadPageData` override pattern.

### Shared Page Data Loader

Extract a `loadXxxPageData(context, overrides?)` function serving both GET index and POST error re-render:

```typescript
interface PageData {
  rows: Row[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow: Row | null
  creating: boolean
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

async function loadPageData(
  context: AppContext,
  overrides?: Partial<
    Pick<
      PageData,
      | 'creating'
      | 'editRow'
      | 'formValues'
      | 'fieldErrors'
      | 'formError'
      | 'offset'
      | 'sortColumn'
      | 'sortDirection'
      | 'filter'
    >
  >,
): Promise<PageData> {
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined
  // Sort, query, paginate...
  return {
    rows,
    offset,
    hasMore,
    prevOffset,
    nextOffset,
    sortColumn,
    sortDirection,
    filter,
    editRow,
    creating,
    formValues: overrides?.formValues,
    fieldErrors: overrides?.fieldErrors,
    formError: overrides?.formError,
  }
}
```

Key pattern: `overrides?.foo ?? urlParam` — override takes precedence, URL param is fallback.

### Grid State from FormData

Hidden inputs carry sort/filter/pagination state across POST. Use `app/utils/grid-state.ts`:

```typescript
import {
  gridStateFromFormData, // from FormData
  gridStateToParams, // to URLSearchParams
  gridStateOffset, // to number | undefined
  gridStateSort, // to string | undefined
  gridStateDirection, // to 'asc' | 'desc' | undefined
  gridStateFilter, // to string | undefined
  type GridState,
} from '../utils/grid-state.ts'

let gridValues = gridStateFromFormData(formData)
let data = await loadPageData(context, {
  creating: true,
  formValues,
  fieldErrors,
  offset: gridStateOffset(gridValues),
  sortColumn: gridStateSort(gridValues),
  sortDirection: gridStateDirection(gridValues),
  filter: gridStateFilter(gridValues),
})
return renderPage(context, data, { status: 400 })
```

### Admin Grid Error Path: `renderGridFormError` returns 200, not 400

When an admin **grid** page routes its validation-error re-render through the shared helper (`app/ui/admin-grid-error.tsx` → `renderGridFormError`), the response is always **status 200**, NOT 400.

**Why:** the admin frame transport treats any non-OK response as an unrecoverable error card, so a validation-error re-render MUST be a 200 to show inline field errors in the frame. The helper renders `renderAdminPage(..., { status: 200 })`.

This is the `/admin/users` pattern — `renderUsersError` delegates to `renderGridFormError` (status 200) and the users tests assert `response.status === 200` on validation failure. A grid action using this helper MUST assert 200, not 400:

```typescript
import { renderGridFormError, type AdminGridErrorState } from '../../ui/admin-grid-error.tsx'

async function renderClientsError(context, opts): Promise<Response> {
  let grid: AdminGridErrorState = { offset: opts.offset, sortColumn: opts.column, sortDirection: opts.direction, filter: opts.filter, pageSize: opts.pageSize }
  return renderGridFormError<Row>({
    render: context.render,
    activeItem: 'clients',
    loadRows: () => loadGridData(context.db, opts),
    buildPage: (page) => <ClientPage ... />,
    formValues: opts.formValues,
    fieldErrors: opts.fieldErrors,
    grid,
  }) // → renderAdminPage(..., { status: 200 })
}
```

**Contrast:** `context.render(<Page/>, { status: 400 })` (Pattern 1 in `validation-and-schema.md`) is for full-page / non-admin-frame forms. Inside the admin frame, route validation through `renderGridFormError` so inline errors appear at 200. When a spec/test says "returns 400" for a grid page that uses `renderGridFormError`, it describes stale behavior — correct it to 200 (see the users test `assert.equal(response.status, 200)`).

### Form Error Banner Styles

Two distinct banners — page level (solid) and form level (subtle):

```css
/* Page-level (above table, no form active) */
table.errorBanner: {
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
}

/* Form-internal (inside form panel on validation failure) */
formErrorBanner: {
  background: `${theme.colors.action.danger.background}15`,  /* ~8% opacity */
  border: `1px solid ${theme.colors.action.danger.background}`,
  color: theme.colors.action.danger.background,
}
```

### Avoid Double Error Display

When a form panel is open, `formError` renders ONLY inside the form, NOT at page level. Use `!hasFormPanel` to gate:

```tsx
// Page-level grid section — hidden when form is open
{
  !hasFormPanel && formError ? <div mix={table.errorBanner}>{formError}</div> : null
}
{
  !hasFormPanel && error ? <div mix={table.errorBanner}>{error}</div> : null
}

// Inside the form component
{
  formError ? <div mix={formErrorBanner}>{formError}</div> : null
}
```

Keep `formError` (form validation) and `error` (destroy flow) strictly separate — never chain them.

### JSX Text Content Warning

Unicode escapes like `\u00e4` are NOT interpreted in JSX text content (only in `{}` expressions). Use actual UTF-8 characters or a JSX expression:

```tsx
// WRONG — renders literal "\u00e4" in browser
<option>ausw\u00e4hlen</option>

// RIGHT
<option>auswählen</option>
<option>{'ausw\u00e4hlen'}</option>
```
