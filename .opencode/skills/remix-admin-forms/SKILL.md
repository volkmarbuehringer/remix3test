---
name: remix-admin-forms
description: Patterns for admin CRUD forms in Remix 3 — render-on-error, shared page loaders, grid state preservation, inline field errors, form error banner styles, double-error prevention, and migration from URL-param roundtrip. Activate when building or refactoring admin form validation error handling.
---

# Remix Admin Forms — Render-on-Error Patterns

Use this skill when building or refactoring admin CRUD forms that need to:
- Preserve user-entered values on validation failure
- Show inline per-field error messages
- Show form-level error banners
- Preserve grid state (sort, filter, pagination) across POST error re-renders
- Prevent double error display (form-level + page-level)
- Migrate legacy forms from URL-param roundtrip to direct re-render

## Core Pattern: Render on Validation Failure

Replace redirect-based error handling (302 → GET decodes URL params) with direct page re-rendering (status 400). The `parseSafe` + `issuesToFieldErrors` + `readFormFieldValues` pipeline lets you return the same page with error state.

```typescript
import { issuesToFieldErrors, readFormFieldValues } from '../utils/schema-utils.ts'
import { gridStateFromFormData, gridStateOffset, gridStateSort, gridStateDirection, gridStateFilter } from '../utils/grid-state.ts'

const FORM_KEYS = ['description'] as const

async create(context) {
  let formData = context.formData
  let gridValues = gridStateFromFormData(formData)

  let result = s.parseSafe(mySchema, formData)

  if (!result.success) {
    let formValues = readFormFieldValues(FORM_KEYS, formData)
    let fieldErrors = issuesToFieldErrors(result.issues)
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
  }

  let parsed = result.value as Record<string, string>
  // ... success: DB insert, redirect ...
}
```

**Key points:**
- `s.parseSafe()` returns `{ success, value, issues }` instead of throwing
- `readFormFieldValues(keys, formData)` reads raw strings from `FormData`
- `issuesToFieldErrors(result.issues)` converts schema issues to `Record<string, string>`
- `gridStateFromFormData()` reads hidden `_offset`/`_sort`/`_order`/`_filter` inputs
- `gridStateOffset/Sort/Direction/Filter` convert to typed overrides
- Render with `{ status: 400 }` — no redirect, no URL encoding

## Shared Page Data Loader

Extract a `loadXxxPageData(context, overrides?)` function that serves both the GET index and POST error re-render paths:

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
  overrides?: Partial<Pick<PageData, 'creating' | 'editRow' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter'>>,
): Promise<PageData> {
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  // Sort: override or URL param
  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const }
    : parseSort(context.url, { ... })

  // Query, paginate...

  // Edit row: override or URL param
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId) {
    editRow = await fetchRow(editingRowId)
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  return {
    rows, offset, hasMore, prevOffset, nextOffset, sortColumn, sortDirection, filter,
    editRow, creating,
    formValues: overrides?.formValues,
    fieldErrors: overrides?.fieldErrors,
    formError: overrides?.formError,  // Don't forget this in the return!
  }
}
```

**Key points:**
- Override pattern: `overrides?.foo ?? urlParam` — override takes precedence
- `|| undefined` normalizes empty strings to `undefined`
- Edit row: `overrides?.editRow !== undefined ? null : url.get('editing')` — explicit null skips URL
- **Always return `formError` in the return statement** if it's in the interface — missing it causes silent failures

## Grid State Preservation

Hidden form inputs carry sort/filter/pagination state across POST:

```html
<GridStateHiddenInputs state={{ offset, sort, order, filter }} />
```

Use `app/utils/grid-state.ts` helpers:

```typescript
import {
  gridStateFromForm,      // from parsed Record<string, string>
  gridStateFromFormData,  // from FormData
  gridStateToParams,      // to URLSearchParams for redirects
  gridStateOffset,         // to number | undefined
  gridStateSort,           // to string | undefined
  gridStateDirection,      // to 'asc' | 'desc' | undefined
  gridStateFilter,         // to string | undefined
  type GridState,
} from '../utils/grid-state.ts'
```

## Form Error Banner Styles

There are two distinct error banner styles for different contexts:

### `table.errorBanner` — Page-Level Errors (Solid)

Used above the table when no form panel is active (e.g., delete error, non-form page errors):
```css
{
  padding: theme.space.sm,
  marginBottom: theme.space.md,
  background: theme.colors.action.danger.background,  /* solid danger color */
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
}
```

### `formErrorBanner` — Form-Internal Errors (Subtle)

Used inside form panels when form submission fails. Transparent background with solid border:
```css
const formErrorBanner = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  marginBottom: theme.space.sm,
  background: `${theme.colors.action.danger.background}15`,   /* ~8% opacity */
  border: `1px solid ${theme.colors.action.danger.background}`,
  borderRadius: theme.radius.md,
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.sm,
})
```

Use `formErrorBanner` in form components (create/edit pages), `table.errorBanner` in page-level grid sections.

## Page Component: Error Display

```tsx
// Props interface
interface AdminPageProps {
  rows: Row[]
  // ... grid props ...
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  error?: string    // from URL params (destroy flow)
}

// Grid section — gate BOTH error types behind !hasFormPanel
let hasFormPanel = !!(editRow || creating)
let gridSection = (
  <div mix={table.minWidth0}>
    {!hasFormPanel && formError ? <div mix={table.errorBanner}>{formError}</div> : null}
    {!hasFormPanel && error ? <div mix={table.errorBanner}>{error}</div> : null}
    {/* ... filter bar, table, pagination ... */}
  </div>
)

// Inline field error inside the form panel
let hasError = !!fieldErrors?.description
<input
  name="description"
  value={formValues?.description ?? row.description ?? ''}
  mix={[input.base, input.focus, ...(hasError ? [input.error] : [])]}
/>
{hasError ? <div mix={errorTextStyle}>{fieldErrors!.description}</div> : null}
```

Use `fieldErrors!` with non-null assertion after the `hasError` guard.

## Avoiding Double Error Display

When a form panel is open, `formError` should render ONLY inside the form (using `formErrorBanner`), NOT at page level (using `table.errorBanner`). Use `!hasFormPanel` to gate both `formError` and `error` at the page level:

```tsx
// Page-level grid section
{!hasFormPanel && formError ? <div mix={table.errorBanner}>{formError}</div> : null}
{!hasFormPanel && error ? <div mix={table.errorBanner}>{error}</div> : null}

// Inside the form component
<formError ? <div mix={formErrorBanner}>{formError}</div> : null}
```

**Controller side:** Keep `formError` and `error` strictly separate:

```typescript
// WRONG — chains formError to URL error param, causing doubled messages
let formError = overrides?.formError ?? error

// RIGHT — keep them independent
let formError = overrides?.formError ?? undefined
```

The `error` URL param (`?error=...`) is only used by the `destroy` action's simple redirect flow. It never mixes with form-level `formError`.

## Migration Checklist: URL Params → Direct Re-Render

When converting a legacy controller from URL-param roundtrip to direct re-render:

1. **Add `ResponseInit` to render helper** — `renderPage(context, data, init?: ResponseInit)`
2. **Replace `buildErrorRedirectUrl()`** — use `loadPageData(context, overrides)` + `renderPage(context, data, { status: 400 })`
3. **Use `gridStateFromFormData`** — with extractor functions instead of manual `formData.get(...)`
4. **Remove URL-param decoding** — `formValues`/`fieldErrors` from overrides only, no `decodeFormValues`/`decodeFieldErrors`
5. **Replace `table.errorBanner` in forms** — use local `formErrorBanner` style for form-internal errors
6. **Add `!hasFormPanel` gate** — gate both `formError` and `error` at page level
7. **Verify no remaining consumers of `form-params.ts`** — then delete the file
8. **Update tests** — `302` → `400` for error assertions, remove `Location` header checks
9. **Run typecheck + tests** — verify clean
10. **Run code-reviewer subagent** — catches latent issues like fallback chain bugs

## JSX Text Content Warning

Unicode escapes like `\u00e4` are NOT interpreted in JSX text content (only in `{}` expressions). Use actual UTF-8 characters:

```tsx
// WRONG — renders literal "\u00e4" in browser
<option>ausw\u00e4hlen</option>

// RIGHT — use actual character or JSX expression
<option>auswählen</option>
<option>{'ausw\u00e4hlen'}</option>
```
