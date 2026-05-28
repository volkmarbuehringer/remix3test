<!-- Context: project-intelligence/my_app/guides | Priority: high | Version: 2.0 | Updated: 2026-05-04 -->

# Guide: Inline Editing with clientEntry & Event Delegation

**Purpose**: Build a data grid with sortable columns, Frame-based pagination, inline cell editing, and a full-page edit form using `clientEntry` + event delegation. Inline edits are client-side only (lost on page change); edit form uses server redirect with state preservation.

## Architecture Overview

```
?sort=field&order=asc|desc       Query param state for sort + pagination
     ↓
/client  (GET)                  → Page shell with <Frame>
  └─ Layout + <Frame name="client-grid" src="/client/grid?offset=0&sort=&order=">
/client/grid  (GET)             → Fragment with table + <GridClient>
  └─ Server: sortRows() + paginated slice (20/page, 200 total)
  └─ Client: <GridClient> handles sort toggle, pagination, inline edits
/client/edit/:rowId  (GET)      → Full-page edit form
  └─ Breadcrumbs → form + hidden _offset/_sort/_order fields
/client/save  (POST)            → Bulk save + redirect back to /client?offset=N&sort=X&order=Y
```

## Step 1: Define Routes

```typescript
// routes.ts
client: route('client', {
  index: get('/'),           // GET /client — page shell
  grid: get('/grid'),        // GET /client/grid — fragment for Frame
  edit: get('/edit/:rowId'), // GET /client/edit/:rowId — edit form
  save: post('/save'),       // POST /client/save — log cell edit OR bulk save
}),
```

**Convention**: Directory controller at `app/actions/client/controller.tsx` houses all four actions (index, grid, edit, save). No auth middleware — public route for testing.

## Step 2: Page Shell with Frame

```typescript
// controller.tsx
export default {
  actions: {
    index() { return render(<ClientPage />) },
    grid({ url }) {
      let offset = Number(url.searchParams.get('offset')) || 0
      let page = MOCK_ROWS.slice(offset, offset + PAGE_SIZE)
      return renderFragment(<ClientGridPage rows={page} offset={offset} ... />)
    },
    save({ get }) {
      let fd = get(FormData)
      console.log(`Cell update: row=${fd.get('rowId')}, field=${fd.get('field')}, value=${fd.get('value')}`)
      return Response.json({ ok: true })
    },
  },
}
```

```typescript
// page.tsx — Frame points to separate fragment route
<Frame name="client-grid" src={routes.client.grid.href({ offset: 0 })} fallback={<SkeletonCard />} />
```

**Key**: Frame loads `/client/grid` — a separate fragment route from the page shell. v2 pattern: single `src` param, no `x-remix-target`.

## Step 3: Grid Fragment with data-* Attributes

The fragment renders a table with special attributes that the clientEntry targets:

```typescript
// grid-page.tsx
<td data-editable="true" data-row-id={row.id} data-field="name">{row.name}</td>

<button data-pagination="true" data-offset={offset - 20} disabled={!hasPrev}>← Prev</button>
<button data-pagination="true" data-offset={offset + 20} disabled={!hasNext}>Next →</button>
<GridClient />  {/* hydration anchor — renders null */}
```

**Attribute contract for clientEntry:**

| Attribute | Purpose | Used By |
|-----------|---------|---------|
| `data-editable="true"` | Marks cell as inline-editable | dblclick handler |
| `data-row-id` | Row identifier for save POST | finalize handler |
| `data-field` | Field name for save POST + editor type selection | createEditor factory |
| `data-sortable="true"` | Marks column header as click-to-sort | click handler |
| `data-pagination="true"` | Marks pagination buttons | click handler |
| `data-offset` | Page offset for fetch URL | click handler |

## Step 4: clientEntry with Event Delegation

```typescript
// assets/grid-client.ts
export const GridClient = clientEntry(
  import.meta.url,
  function GridClient(handle: Handle) {
    let initialized = false
    let currentOffset = 0

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        // Pagination: event delegation on [data-pagination]
        document.addEventListener('click', (e) => {
          let btn = (e.target as HTMLElement).closest('[data-pagination]') as HTMLElement | null
          if (!btn) return
          let offset = btn.getAttribute('data-offset')
          if (offset === null) return
          currentOffset = Number(offset)
          fetchPage(currentOffset)  // fetch → DOMParser → innerHTML swap
        })

        // Inline editing: dblclick on [data-editable]
        document.addEventListener('dblclick', (e) => {
          let cell = (e.target as HTMLElement).closest('[data-editable]') as HTMLElement | null
          if (!cell) return
          // ... create editor, attach finalize listeners
        })
      }
      return null  // No visible UI
    }
  },
)
```

**Three-guard pattern**: `initialized` flag (run-once) + `typeof document !== 'undefined'` (SSR guard) + return `null` (no DOM output).

## Step 5: Editor Factory Pattern

The `createEditor` function selects between dropdown and text input based on field type:

```typescript
const DROPDOWN_OPTIONS: Record<string, string[]> = {
  role: ['Admin', 'Editor', 'Viewer'],
  status: ['Active', 'Inactive'],
}

function createEditor(field: string, currentValue: string) {
  let options = DROPDOWN_OPTIONS[field]
  if (options) {
    // Dropdown select for enum-like fields
    let select = document.createElement('select')
    for (let opt of options) {
      let optionEl = document.createElement('option')
      optionEl.value = opt
      optionEl.textContent = opt
      if (opt === currentValue) optionEl.selected = true
      select.appendChild(optionEl)
    }
    return { element: select, getValue: () => select.value }
  }

  // Text input for free-form fields
  let input = document.createElement('input')
  input.type = 'text'
  input.value = currentValue
  return { element: input, getValue: () => input.value }
}
```

**Key**: Editors are native DOM elements created at edit time, not Remix components. The factory pattern keeps the field→editor mapping in one place.

## Step 6: Save Flow (Finalize)

When the user finishes editing, the value is saved and the cell is updated:

```
User action            → finalize()
  Enter/blur/change    → if value changed: POST /client/save → update cell textContent
  Escape               → revert cell textContent to original value
```

```typescript
let finalize = () => {
  let newValue = getValue()
  if (newValue !== currentValue) {
    saveCell(Number(rowId), field, newValue).then((ok) => {
      cell.textContent = ok ? newValue : currentValue  // revert on failure
    })
  } else {
    cell.textContent = currentValue  // no change — just restore
  }
}

element.addEventListener('keydown', (ke) => {
  if (ke.key === 'Enter') { ke.preventDefault(); element.blur() }
  if (ke.key === 'Escape') { ke.preventDefault(); cell.textContent = currentValue }
})
element.addEventListener('blur', finalize)
if (element instanceof HTMLSelectElement) {
  element.addEventListener('change', () => element.blur())
}
```

## Step 7: Pagination via fetch + innerHTML

Pagination replaces the grid content via client-side fetch rather than navigating:

```typescript
function fetchPage(offset: number, sort?: string, order?: string): void {
  let container = document.getElementById('client-grid-content')
  if (!container) return
  let params = new URLSearchParams({ offset: String(offset) })
  if (sort) params.set('sort', sort)
  if (order) params.set('order', order)
  fetch('/client/grid?' + params.toString(), { credentials: 'same-origin' })
    .then((r) => r.text())
    .then((html) => {
      let doc = new DOMParser().parseFromString(html, 'text/html')
      let newContent = doc.getElementById('client-grid-content')
      if (newContent) container.innerHTML = newContent.innerHTML
    })
}
```

**Why fetch+swap instead of Frame re-render?** The grid fragment is re-requested from the server in full. Event delegation survives DOM replacement because listeners are on `document`. Client-side edit state is intentionally lost — demonstrating the server-as-source-of-truth boundary. Sort state is maintained across pagination by passing `sort` and `order` params through to every fetch.

## Step 8: Sortable Columns Pattern

Sort is toggled client-side via `[data-sortable]` click delegation and performed server-side on the full 200-row set before slicing.

### Client Entry: Sort Toggle

```typescript
// assets/grid-client.ts — module-level sort state
let currentSort = ''
let currentOrder = 'asc'

// Click handler for sortable headers
document.addEventListener('click', (e) => {
  let th = (e.target as HTMLElement).closest('[data-sortable]') as HTMLElement | null
  if (!th) return
  let field = th.getAttribute('data-field')
  if (!field) return
  if (field === currentSort) {
    currentOrder = currentOrder === 'asc' ? 'desc' : 'asc'  // toggle direction
  } else {
    currentSort = field
    currentOrder = 'asc'  // new column → start ascending
  }
  fetchPage(0, currentSort, currentOrder)  // reset to page 0 with new sort
})
```

**Mechanism:**
- `fetchPage(0, currentSort, currentOrder)` passes sort params as query string to `/client/grid`
- The server re-executes `sortRows()` on the full 200-row array, then slices 20 rows
- `fetchPage` passes `sort`/`order` through every request, so pagination preserves sort order

### Grid Fragment: Sort Arrow Indicator

```typescript
// grid-page.tsx — arrow in header
function sortArrow(field: string, sortField: SortField, sortOrder: 'asc' | 'desc'): string {
  if (field !== sortField) return ' ↕'   // unsorted
  return sortOrder === 'asc' ? ' ↑' : ' ↓'  // sorted
}

// Usage in <th>:
<th mix={thSortableStyle} data-sortable="true" data-field="name">
  Name{sortArrow('name', sortField, sortOrder)}
</th>
```

The server renders the arrow indicator based on `sortField` and `sortOrder` props passed from the controller. Three states: `↕` (not sorted), `↑` (ascending), `↓` (descending).

### Server: sortRows()

```typescript
// controller.tsx
function sortRows<T>(rows: T[], field: keyof T, order: 'asc' | 'desc'): T[] {
  let sorted = [...rows]
  sorted.sort((a, b) => {
    let aVal = String(a[field] ?? '')
    let bVal = String(b[field] ?? '')
    return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
  })
  return sorted
}
```

Only sorts when a valid field is provided. Falls back to insertion order (unsorted) when no `?sort=` param is present. The grid controller validates sort field against `SORTABLE_FIELDS` before applying.

### URL State Flow

```
User clicks header   →  clientEntry toggles currentSort/currentOrder
                     →  fetchPage(0, currentSort, currentOrder)
                     →  GET /client/grid?sort=name&order=asc&offset=0
                     →  Server: sortRows(MOCK_ROWS, 'name', 'asc') → slice 0-20
                     →  Re-renders grid fragment with arrows + sorted rows
```

Sort state is **ephemeral** to the clientEntry module — not persisted in URL. The `?sort=` and `?order=` params in the Frame src are set initially from the page shell props (which come from the index controller reading `url.searchParams`).

## Step 9: Edit Route Pattern

The edit route (`/client/edit/:rowId`) provides a full-page form that preserves pagination and sort state across the edit-then-redirect flow.

### State Preservation Contract

```
Grid table               →  Edit link:  /client/edit/42?offset=0&sort=name&order=asc
Edit form (hidden fields) →  _offset, _sort, _order
Save (POST /client/save)  →  Redirect to /client?offset=0&sort=name&order=asc
Frame src rebuild         →  /client/grid?offset=0&sort=name&order=asc
```

### Edit Form Page

```typescript
// edit-page.tsx — key elements
<form method="POST" action="/client/save">
  <input type="hidden" name="rowId" value={row.id} />
  <input type="hidden" name="_offset" value={offset} />
  <input type="hidden" name="_sort" value={sort} />
  <input type="hidden" name="_order" value={order} />

  <label htmlFor="edit-name">Name</label>
  <input id="edit-name" name="name" type="text" value={row.name} required maxLength={100} />

  <label htmlFor="edit-role">Role</label>
  <select id="edit-role" name="role">
    <option value="Admin" selected={row.role === 'Admin'}>Admin</option>
    <option value="Editor" selected={row.role === 'Editor'}>Editor</option>
    <option value="Viewer" selected={row.role === 'Viewer'}>Viewer</option>
  </select>

  <!-- Same pattern for email, status, registered -->

  <button type="submit">Save Changes</button>
  <a href={buildCancelUrl(offset, sort, order)}>Cancel</a>
</form>
```

**Convention:** All five fields are submitted as individual named form fields (`name`, `email`, `role`, `status`, `registered`). The ID is displayed as a badge — not editable.

### Save Action: Bulk Form Processing

```typescript
// controller.tsx — save() action
save({ get, url }) {
  let formData = get(FormData)
  let rowId = formData.get('rowId')

  // Bulk form save (from edit page)
  let bulkFields = ['name', 'email', 'role', 'status', 'registered']
  let changes: string[] = []
  for (let f of bulkFields) {
    let v = formData.get(f)
    if (v && typeof v === 'string') {
      changes.push(`${f}=${v}`)
    }
  }
  if (changes.length > 0) {
    console.log(`[ClientLab] Form save row=${rowId}: ${changes.join(', ')}`)
    // Redirect back with preserved state
    let offset = formData.get('_offset')
    let sort = formData.get('_sort')
    let order = formData.get('_order')
    let params = new URLSearchParams()
    if (offset) params.set('offset', offset as string)
    if (sort) params.set('sort', sort as string)
    if (order) params.set('order', order as string)
    let qs = params.toString()
    return new Response(null, {
      status: 302,
      headers: { Location: '/client' + (qs ? '?' + qs : '') },
    })
  }

  // Single-field save (from inline editing) — handled separately
  // ...
}
```

**Key**: The save action detects whether it's a bulk form save (multiple named fields present) or a single-field inline edit (`field` + `value` params) and processes accordingly.

### Breadcrumb Navigation

```typescript
<Breadcrumbs
  items={[
    { label: 'Home', href: routes.home.href() },
    { label: 'Client Lab', href: buildCancelUrl(offset, sort, order) },
    { label: `Edit Row #${row.id}` },
  ]}
/>
```

Breadcrumbs link back to the client lab with preserved page/sort state, so the user never loses their place.

### Column Colgroup + Edit Link

The grid adds a 7th column (60px) for the Edit link:

```typescript
<col style={{ width: '60px' }} />
{/* ... */}
<th mix={thStyle}>Edit</th>
{/* ... */}
<td mix={tdIdStyle}>
  <a href={editHref} mix={editLinkStyle}>Edit</a>
</td>
```

The `editHref` is built per-row with the current page/sort state:
```typescript
let editParams = new URLSearchParams({ offset: String(offset) })
if (sortField) editParams.set('sort', sortField)
if (sortOrder) editParams.set('order', sortOrder)
let editHref = '/client/edit/' + row.id + '?' + editParams.toString()
```

## Step 10: Frame Query Param Propagation

Sort and pagination state must flow through the entire chain: URL → Controller → Page Shell → Frame src → Grid Fragment.

### Propagation Chain

```
Browser URL: /client?offset=20&sort=name&order=asc
                       ↓
index({ url }) reads url.searchParams          [controller.tsx]
  initialOffset = '20', initialSort = 'name', initialOrder = 'asc'
                       ↓
<ClientPage initialOffset initialSort initialOrder />  [page.tsx]
                       ↓
buildGridSrc(offset, sort, order)  →  URLSearchParams
                       ↓
<Frame src="/client/grid?offset=20&sort=name&order=asc" />
                       ↓
grid({ url }) reads url.searchParams            [controller.tsx]
  offset=20, sort=name, order=asc
  → sortRows(MOCK_ROWS, 'name', 'asc')
  → slice(20, 40)
                       ↓
<ClientGridPage sortField="name" sortOrder="asc" ... />  [grid-page.tsx]
  → renders headers with ↑ arrows + sorted data
```

### buildGridSrc Helper

```typescript
// page.tsx — constructs Frame src URL from props
function buildGridSrc(offset: string, sort: string, order: string): string {
  let params = new URLSearchParams()
  if (offset) params.set('offset', offset)
  if (sort) params.set('sort', sort)
  if (order) params.set('order', order)
  let qs = params.toString()
  return routes.client.grid.href() + (qs ? '?' + qs : '')
}
```

This is a **unidirectional state flow**: the Frame src is set once during server rendering. Client-side sort/pagination changes via `fetchPage()` do NOT update the browser URL — they only affect the fragment content via innerHTML swap.

### Why Not URL Updates on Sort?

The sort state remains in the clientEntry module (`currentSort` / `currentOrder`) rather than updating the browser URL because:

- **Fragment isolation**: The grid content is inside a `<Frame>`, which is a separate fragment route managed client-side
- **Simplicity**: The edit route flow needs the page/sort state at redirect time, which comes from hidden form fields, not URL state
- **Server authority**: On full page reload, the initial sort state comes from the URL query params, which are set by the page shell props

## Cross-cutting Concerns

| Concern | Solution |
|---------|----------|
| **Asset server allow list** | `app/assets/**` glob covers `grid-client.ts` — no per-file entry needed |
| **SSR safety** | `typeof document !== 'undefined'` guards in clientEntry |
| **Frame re-render on page change** | Grid fragment is re-fetched fresh — no server-side edit persistence |
| **Event delegation survival** | `document.addEventListener` with `closest()` — listeners survive innerHTML swaps |
| **Select immediate finalize** | `change` event on `<select>` calls `blur()` immediately |
| **Save failure** | Revert cell to original value on POST failure |
| **Sort across pagination** | `fetchPage()` passes `sort`+`order` params on every request; server re-sorts full set before slice |
| **Edit state preservation** | Hidden `_offset`/`_sort`/`_order` fields in edit form; redirect back with same query params |
| **Sort toggle detection** | clientEntry compares `field === currentSort` to decide toggle vs new column |
| **Invalid sort field** | Controller validates against `SORTABLE_FIELDS` before applying `sortRows()` |

## Codebase References

- Route definitions: `my_app/app/routes.ts` (lines 46-51)
- Router wiring: `my_app/app/router.ts` (line 75)
- Controller: `my_app/app/actions/client/controller.tsx` — `index()` reads sort/offset, `grid()` sorts+paginatates, `edit()` finds row+binds params, `save()` bulk/single-field processing
- Page shell: `my_app/app/actions/client/page.tsx` — `buildGridSrc()` propagates offset/sort/order to Frame src
- Grid fragment: `my_app/app/actions/client/grid-page.tsx` — sortable headers with arrow indicators, Edit column with preserved query params
- Edit form: `my_app/app/actions/client/edit-page.tsx` — breadcrumbs, hidden _offset/_sort/_order fields, styled form
- clientEntry: `my_app/app/assets/grid-client.ts` — sort toggle state, pagination fetch with sort params, editor factory
- Tests: `my_app/app/actions/client/controller.test.ts`
- Tests: `my_app/app/actions/client/page.test.ts`
- Tests: `my_app/app/actions/client/grid-page.test.ts`

## Related

- `development/remix3/guides/client-entry-side-effects.md` — Side-effect-only clientEntry (general pattern)
- `development/remix3/guides/client-interactivity-patterns.md` — clientEntry vs inline script decision guide
- `development/remix3/guides/frames.md` — Frame basics
- `development/remix3/guides/render-utilities.md` — renderFragment
- `project-intelligence/my_app/concepts/architecture.md` — Base app conventions
- `project-intelligence/my_app/navigation.md` — Client Runtime Lab index with route table and quick tips
