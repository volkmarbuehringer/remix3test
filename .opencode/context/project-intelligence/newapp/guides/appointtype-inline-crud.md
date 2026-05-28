<!-- Context: project-intelligence/newapp/guides/appointtype-inline-crud | Priority: high | Version: 1.0 | Updated: 2026-05-23 -->

# Guide: AppointType Inline CRUD (Frame-Based)

**Purpose**: Manage appointment types via an inline panel loaded inside a `<Frame>` — create, rename, and delete types using an in-place JSON API with context menu, no full-page navigations.

---

## Architecture

```
Appointment Page (appointment-page.tsx)
  ├── <AppointmentSidebar />       — week nav, year/week selects
  ├── <Frame name="appoint-types"  — loads types panel
  │     src="/appointment/types">
  │      └── GET /appointment/types → appointtype-controller.tsx index()
  │             └── <AppointTypePanel /> (clientEntry)
  │
  └── <AppointmentGrid />          — the calendar grid
```

**Key difference from other CRUD patterns** — This uses **JSON API + clientEntry** for mutations, not server-rendered forms. The types panel is a compact list with inline-editable text, not a full form layout. This is the right trade-off because:
- Types have only one editable field (title)
- Space is constrained (sidebar panel below week nav)
- Drag-and-drop needs interactive state (pointer captures) that server round-trips can't support

---

## Frame Loading

### Page Shell (`appointment-page.tsx`)

The Frame sits below the sidebar in the left column:

```tsx
<div mix={leftColStyle}>
  <AppointmentSidebar />
  <Frame name={frames.appointTypes} src="/appointment/types" />
</div>
```

`frames.appointTypes` is defined in `app/routes.ts`:
```ts
export const frames = {
  // ...
  appointTypes: 'appoint-types',
} as const
```

### Controller Index Action (`appointtype-controller.tsx`)

The `index` action renders the panel inside a fragment response (no full page layout):

```tsx
async index(context) {
  let auth = context.auth
  if (!auth?.ok) return new Response(null, { status: 401 })
  let userId = (auth.identity as User).id

  let types = await listAppointTypes(context.db, userId)
  let csrfToken = getCsrfToken(context)

  let data = JSON.stringify({ types, csrfToken })

  return context.render(
    <>
      <script id="appointtype-data" type="application/json">{data}</script>
      <AppointTypePanel csrfToken={csrfToken} />
    </>,
    fragmentResponseInit(),  // ← Cache-Control: no-store
  )
}
```

**Pattern**: Server renders a `<script type="application/json">` tag with the data, plus the `clientEntry` component. The clientEntry reads the data from the DOM on initialization and re-reads after Frame reloads.

---

## JSON API Actions

All mutations use JSON request/response, not HTML forms:

| Method | Path | Action | Request Body | Response |
|--------|------|--------|-------------|----------|
| `POST` | `/appointment/types` | `create` | `{ title: string }` | `{ type }` (201) |
| `PUT` | `/appointment/types/:id` | `update` | `{ title?: string }` | `{ type }` (200) |
| `DELETE` | `/appointment/types/:id` | `destroy` | — | `{ deleted: true }` (200) |

### Controller Pattern

All actions follow the same structure:
1. **Auth check** — `requireAuth()` middleware + `auth.identity` cast
2. **JSON parse** — `context.request.json()` with try/catch
3. **Schema validation** — `s.parseSafe(schema, body)` with error response
4. **Data layer** — Delegates to `data/appointtypes.ts`
5. **Error mapping** — `AppointTypeError` → JSON error response with status

```tsx
async create(context) {
  // 1. Auth
  let auth = context.auth
  if (!auth?.ok) return Response.json({ error: '...' }, { status: 401 })
  let userId = (auth.identity as User).id

  // 2. Parse
  let body: unknown
  try {
    body = await context.request.json()
  } catch {
    return Response.json({ error: 'Expected a valid JSON request body.' }, { status: 400 })
  }

  // 3. Validate
  let parsed = s.parseSafe(createSchema, body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed.' }, { status: 400 })
  }

  // 4. Create
  let type = await createAppointType(context.db, userId, parsed.value)
  return Response.json({ type }, { status: 201 })
}
```

---

## Client-Side Inline Editing

The `AppointTypePanel` (`clientEntry`) manages all interaction state in closure variables:

| State | Type | Purpose |
|-------|------|---------|
| `adding` | `boolean` | Whether the "add new" input row is visible |
| `addInput` | `HTMLInputElement \| null` | Ref to the add input |
| `editingId` | `number \| null` | Which type is being renamed (inline input) |
| `editInputs` | `Map<number, HTMLInputElement>` | Refs to rename inputs by type id |
| `lastRightClickedType` | `AppointType \| null` | Types for context menu actions |

### Add (Inline Input)

Clicking "+ Add Type" reveals an input row. On Enter/blur, the value is sent via `fetch()`:

```tsx
async function commitAdd(csrfToken: string) {
  if (!adding) return
  let title = addInput?.value?.trim() ?? ''
  if (!title) { cancelAdd(); return }

  adding = false          // Hide input immediately
  handle.update()         // Re-render without input

  // POST then reload Frame
  let response = await fetch('/appointment/types', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Csrf-Token': csrfToken,
    },
    body: JSON.stringify({ title }),
    signal: handle.signal,
  })
  if (response.ok) {
    await handle.frame?.reload()  // ← Frame reload (not full page reload)
  } else {
    alert('Fehler beim Speichern.')
  }
}
```

**Important detail** — The Frame is reloaded via `handle.frame?.reload()`, which triggers a fetch for the Frame's `src` URL and replaces only the Frame content. This is different from `window.location.reload()` used by the appointment grid.

### Rename (Inline Input)

Clicking a type name turns it into an input field. Escape cancels, Enter/blur commits:

```tsx
function commitRename(type: AppointType, csrfToken: string) {
  if (editingId !== type.id) return

  let newTitle = getEditValue(type.id)
  if (!newTitle || newTitle === type.title) {
    editingId = null
    handle.update()
    return                       // No-op if unchanged
  }

  let id = type.id
  editingId = null               // Hide input
  handle.update()

  fetch(`/appointment/types/${id}`, {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Csrf-Token': csrfToken,
    },
    body: JSON.stringify({ title: newTitle }),
    signal: handle.signal,
  })
    .then((r) => {
      if (r.ok) handle.frame?.reload()
      else alert('Fehler beim Speichern.')
    })
    .catch(() => alert('Fehler beim Speichern.'))
}
```

### Delete (Context Menu)

Right-click opens a `remix/ui/menu` context menu with "Edit" and "Delete" options:

```tsx
// Context menu state trigger — positioned at right-click location
<div
  mix={menu.contextTrigger()}
  data-type-trigger="true"
  style="display:none;position:fixed;width:1px;height:1px"
/>
<MenuList mix={onMenuSelect((event) => {
  if (lastRightClickedType) {
    handleAction(lastRightClickedType, event, csrfToken)
  }
})}>
  <MenuItem name="edit">✏️ Bearbeiten</MenuItem>
  <MenuItem name="delete">🗑️ Löschen</MenuItem>
</MenuList>

// Right-click → position the hidden trigger → dispatch contextmenu event
function handleContextMenu(type: AppointType, event: MouseEvent) {
  event.preventDefault()
  lastRightClickedType = type
  handle.update()

  let trigger = document.querySelector<HTMLElement>('[data-type-trigger]')
  if (trigger) {
    trigger.style.left = event.clientX + 'px'
    trigger.style.top = event.clientY + 'px'
    trigger.style.display = 'block'
    trigger.dispatchEvent(new MouseEvent('contextmenu', { ... }))
    setTimeout(() => { trigger.style.display = 'none' }, 100)
  }
}
```

Delete shows a `confirm()` dialog, then uses `fetch` with `DELETE`:

```tsx
case 'delete': {
  if (!confirm(`"${type.title}" wirklich löschen?`)) return
  fetch(`/appointment/types/${type.id}`, {
    method: 'DELETE',
    headers: { 'Accept': 'application/json', 'X-Csrf-Token': csrfToken },
  })
    .then((r) => {
      if (r.ok) handle.frame?.reload()
      else alert('Fehler beim Löschen.')
    })
    .catch(() => alert('Fehler beim Löschen.'))
  break
}
```

---

## Data Layer (`app/data/appointtypes.ts`)

Standard CRUD functions that always scope by `userId`:

```tsx
export async function createAppointType(
  db: Database, userId: number, input: AppointTypeInput
): Promise<AppointType> {
  let result = await db.create(appointtypes, {
    user_id: userId,
    title: input.title.trim(),
  }, { returnRow: true })
  return result as AppointType
}
```

**Key patterns**:
- `userId` is always a required parameter — never read from the session inside data functions
- `update` and `delete` use `findOne` with `{ id, user_id }` to verify ownership first
- `create` injects `user_id` from the caller, not from the untrusted request body
- Titles are `trim()`ed before storage

---

## Schema (`app/data/schema.ts`)

```ts
export const appointtypes = table({
  name: 'appointtypes',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    user_id: c.integer(),
    title: c.text(),
    created_at: c.bigint(),
    updated_at: c.bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }
    if (operation === 'create') {
      let now = Date.now()
      if (next.created_at === undefined) next.created_at = now
      if (next.updated_at === undefined) next.updated_at = now
    }
    if (operation === 'update') {
      next.updated_at = Date.now()
    }
    return { value: next }
  },
  afterRead({ value }) {
    if (typeof value.created_at === 'string') value.created_at = parseInt(value.created_at, 10)
    if (typeof value.updated_at === 'string') value.updated_at = parseInt(value.updated_at, 10)
    return { value }
  },
})
```

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/routes.ts` | 8, 45–51 | Route definitions (`/appointment/types`) + Frame name `appointTypes` |
| `app/router.ts` | 31, 84 | Import + map `appointTypeController` to `appointmentRoutes.appointment.types` |
| `app/actions/appointtype-controller.tsx` | 1–129 | Controller with `index`, `create`, `update`, `destroy` actions |
| `app/ui/appointtype-panel.tsx` | 1–408 | Full `clientEntry` component — list, inline add, rename, context menu, drag init |
| `app/ui/appointment-page.tsx` | 48–49 | Frame rendering in left column below sidebar |
| `app/data/appointtypes.ts` | 1–81 | Data layer — `listAppointTypes`, `createAppointType`, `updateAppointType`, `deleteAppointType` |
| `app/data/schema.ts` | 322–352 | `appointtypes` table definition with `beforeWrite`/`afterRead` |

## Related

- [AppointType Drag-to-Insert](./appointtype-drag-insert.md) — Dragging types from this panel onto the grid to create appointments
- [AppointType INSERT...SELECT](./appointtype-insert-select.md) — Server-side creation path for type-drag drops
- [Frame CRUD Pattern](./frame-crud-pattern.md) — General Frame-based pattern (this feature uses a lighter JSON variant)
- [Context Menu Patterns](../../development/remix3/ui/guides/context-menu-patterns.md) — hidden trigger vs direct trigger
- [Context Menu (concept)](../../development/remix3/ui/concepts/context-menu.md) — `remix/ui/menu` API for context menus
- [Drag-to-Trashcan Delete](./drag-to-trashcan.md) — Similar `clientEntry` + `fetch()` + reload pattern
