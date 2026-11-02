# Admin Grid State Preservation

## What This Covers

Keeping admin CRUD grid state (sort/filter/pagination) across a failed POST, and the error-display rules for the admin frame. Read this when the task involves:

- A shared `loadXxxPageData(context, overrides?)` used by both GET and POST-error renders
- Hidden inputs and `app/utils/grid-state.ts` helpers
- `renderGridFormError` and why the grid error path returns **200, not 400**
- Page-level vs form-level error banners, and avoiding double display
- Optional update fields: keeping absence real so a partial submit cannot rewrite the row
- Unicode escapes in JSX text

For the core validation pattern, see `validation-and-schema.md`. For adding a new filter end-to-end, see `url-param-filter-checklist.md`.

## Admin Forms: Grid State Preservation

Admin CRUD forms often have sort/filter/pagination state that must survive POST error re-renders. Use hidden form inputs + a shared `loadPageData` override pattern.

### Shared Page Data Loader

Extract one `loadXxxPageData(context, overrides?)` used by both the GET index and every POST-error re-render. `overrides?.foo ?? urlParam` — the override wins, the URL is the fallback. Include the grid fields (`offset`, `hasMore`, `prev/nextOffset`, `sortColumn`, `sortDirection`, `filter`) plus the panel/error fields (`editRow`, `creating`, `formValues`, `fieldErrors`, `formError`).

Reference: `app/actions/admin/webhook-requests/controller.tsx:100` (`loadPageData`), `app/actions/client/controller.tsx:177` (`loadGridData`) and `:249` (`renderClientsError`).

### Grid State from FormData

Hidden inputs carry sort/filter/pagination across POST. `app/utils/grid-state.ts` exposes `gridStateFromFormData`, `gridStateToParams`, and `gridStateOverrides`; spread the last one into the loader:

```typescript
let gridValues = gridStateFromFormData(formData)
let data = await loadPageData(context, {
  creating: true,
  formValues,
  fieldErrors,
  ...gridStateOverrides(gridValues),
})
```

`gridStateOverrides()` (typed `GridStateOverrides`) is the single place the six loader overrides are built — one spread replaces the per-branch getter block that used to be copy-pasted into every re-render branch, and the sort direction flows through `gridStateDirection()`'s whitelist, so an invalid `_order` falls back to the caller's default instead of reaching a raw-SQL `ORDER BY` compiler (which throws). Adding a new grid field means adding it inside `gridStateOverrides()` once; existing branches need no change.

### Optional Update Fields: Keep Absence Real

`readFormFieldValues()` fills every key with `''`, so a field omitted from a partial submit still looks present. If the update schema allows optional fields (e.g. `s.optional(s.enum_([...]))`), `formValues` then overrides the row with `''`; if `editRow` is rebuilt from raw values, the edit panel shows fabricated defaults (Viewer/Active, a blank date) and a later save writes them back.

Keep absence real: delete keys the form did not submit before building `formValues`, and load the current row instead of rebuilding `editRow` from raw values.

- Required fields stay in `formValues` (empty when omitted) so their errors remain visible; only absent optional keys are deleted.
- The edit panel's `<select>`/date controls then fall back to `row.*`.
- Do **not** rebuild `editRow` from raw values; load the current row.
- Trigger: a partial/API PUT that omits optional fields and fails another field. Browser forms submit every control, so normal UI submissions are unaffected — but the schema explicitly supports omission.
- Parse with `parseSafe(schema, formData, { errorMap })` so vendor check messages are localized by `code`; `issuesToFieldErrors()` then only keys them by field. See `validation-and-schema.md` § "Localize Built-In Check Messages by `code`, Not `message`".
- Reference implementation: `app/actions/client/controller.tsx:207` (`readClientFormValues`) and the partial-PUT test in `app/actions/client/controller.test.ts`.

### Keep an Open Edit/Create Panel Across Grid Navigation

Sort, pagination, status-tab, and clear-search links are plain GET navigations. If
they omit `editing`/`creating`, the frame reload closes the panel. Append the open
mode to every grid-navigation URL and add hidden inputs so the search form does the
same:

```ts
function withPanelState(href: string, editingId: number | null | undefined, creating: boolean) {
  let panel = editingId ? `editing=${editingId}` : creating ? 'creating=true' : ''
  return panel ? href + (href.includes('?') ? '&' : '?') + panel : href
}
```

- Do not append `creating` to row edit links (`buildEditUrl` already sets `editing`);
  do not append `editing` to the create link (`buildCreateUrl` sets `creating`).
- The search form needs hidden `editing`/`creating` inputs too.
- Reference: `app/actions/client/grid-page.tsx` (`withPanelState`) and
  `app/actions/client/grid-page.test.ts`.

### Admin Grid Error Path: `renderGridFormError` returns 200, not 400

When an admin **grid** page routes its validation-error re-render through `renderGridFormError` (`app/ui/admin-grid-error.tsx`), the response is always **status 200**, NOT 400. The admin frame transport treats any non-OK response as an unrecoverable error card, so a validation-error re-render MUST be a 200 to show inline field errors in the frame; the helper renders `renderAdminPage(..., { status: 200 })` (`app/ui/admin-grid-error.tsx:79`).

This is the `/admin/users` pattern. A grid action using this helper MUST assert 200, not 400. Reference call: `app/actions/client/controller.tsx:249` (`renderClientsError`).

**Contrast:** `context.render(<Page/>, { status: 400 })` (direct re-render in `validation-and-schema.md`) is for full-page / non-admin-frame forms. Inside the admin frame, route validation through `renderGridFormError` so inline errors appear at 200. When a spec/test says "returns 400" for a grid page that uses `renderGridFormError`, it describes stale behavior — correct it to 200 (see the users test `assert.equal(response.status, 200)`).

### Form Error Banner Styles

Two banners: page-level solid `table.errorBanner` (`app/ui/mixins/admin-table.ts:636`) and form-internal subtle `formErrorBanner` (e.g. `app/ui/admin-offerings-create-page.tsx:41`), both using the danger background/foreground tokens. The form variant uses the background at ~8% opacity with a 1px border.

### Avoid Double Error Display

When a form panel is open, render `formError` only inside the form; gate the page-level banner with `!hasFormPanel` so it does not double-display (`app/actions/client/page.tsx:77`). Keep `formError` (form validation) and `error` (destroy flow) strictly separate — never chain them.

### JSX Text Content Warning

Unicode escapes like `\u00e4` are NOT interpreted in JSX text content (only in `{}` expressions). Use actual UTF-8 characters or a JSX expression:

```tsx
// WRONG — renders literal "\u00e4" in browser
<option>ausw\u00e4hlen</option>

// RIGHT
<option>auswählen</option>
<option>{'ausw\u00e4hlen'}</option>
```
