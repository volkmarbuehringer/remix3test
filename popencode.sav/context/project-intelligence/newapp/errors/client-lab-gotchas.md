<!-- Context: project-intelligence/newapp/errors/client-lab-gotchas | Priority: high | Version: 1.0 | Updated: 2026-05-12 -->

# Errors: Client Lab Implementation Gotchas

Lessons learned while porting the client route from `my_app` to `newapp`.

---

## 1. Frame Fragment Caching

**Problem**: Frame fragments (`/client/grid`) were being cached by the browser, showing stale data after save/delete redirects.

**Solution**: Always use `fragmentResponseInit()` from `app/middleware/render.tsx` when rendering Frame fragments. This sets `Cache-Control: no-store` on the response.

```tsx
// controller.tsx
if (isFrame) {
  return render(gridContent, fragmentResponseInit())
}
```

The `fragmentResponseInit` function was added to `app/middleware/render.tsx` specifically for this pattern.

---

## 2. Filter State with Pagination/Sort

**Problem**: When a filter is active, pagination and sort links need to preserve the `filter` param. Additionally, offset should reset to 0 when changing the sort field (you want to see results from the beginning of the new sort order).

**Solution**: All URL builders (`buildSortUrl`, `buildPaginationUrl`) accept and forward the `filter` param. `buildSortUrl` always resets offset to 0.

```ts
function buildSortUrl(field, currentSort, currentOrder, offset, filter) {
  let params = new URLSearchParams()
  params.set('offset', '0')          // ← reset on sort change
  params.set('sort', field)
  params.set('order', newOrder)
  if (filter) params.set('filter', filter)  // ← preserve filter
  return '/client/grid?' + params.toString()
}
```

---

## 3. register Field as String in Form

**Problem**: The `registered` field is stored as `c.bigint()` (millisecond timestamp) in the database, but the edit form displays it as a date string (`YYYY-MM-DD`). When the form submits, the string value needs to be converted back to a timestamp in the controller's `beforeWrite` hook.

**Solution**: The `beforeWrite` hook in `schema.ts` handles this:

```ts
if (typeof next.registered === 'string') {
  let ts = new Date(next.registered).getTime()
  if (!Number.isNaN(ts)) next.registered = ts
}
```

---

## 4. Form Data Type Safety

**Problem**: `formData.get()` returns `FormDataEntryValue | null` (which is `string | File | null`). Direct assignment to a record can cause type issues.

**Solution**: Check that the value is a string before using it:

```ts
for (let f of bulkFields) {
  let v = formData.get(f)
  if (v && typeof v === 'string') {
    changes[f] = v
  }
}
```

---

## 5. Minimal clientEntry — Only DelButton Uses JS

**Design**: The newapp CRUD uses minimal JavaScript. Only `DelButton` uses a clientEntry (for delete confirmation + Frame reload). Grid navigation uses Frame fragment loads (`rmx-target`), edit/create use inline sidebar panels (not pages), and sort/filter/paginate are server round-trips. State preservation via hidden form fields or query params.

---

## 6. Native `<select>` Instead of `remix/ui/select`

**Decision**: The edit form uses native HTML `<select>` elements instead of `remix/ui/select`. Rationale: the `select` component would need `mix` prop support and adds unnecessary complexity for a lab demo.

Native `<select>` styling uses `input.base` and `input.focus` mixins:

```tsx
<select id="ef-role" name="role"
  mix={[input.base, input.focus, selectStyle]}>
  <option value="Admin" selected={row.role === 'Admin'}>Admin</option>
</select>
```

---

## 7. data-schema parse Can Throw — Always try/catch

**Problem**: `s.parse()` can throw even with `defaulted()` fields.

**Solution**: Wrap in try/catch:

```ts
try { parsed = s.parse(clientSaveSchema, formData) } catch {
  return Response.json({ error: 'Invalid form data' }, { status: 400 })
}
```

---

## 8. `methodOverride()` Must Come After `formData()`

**Problem**: `methodOverride()` reads `_method` from `context.formData`. Wrong order → `_method` unread → PUT/DELETE silently 404.

**Solution**: `formData()` then `methodOverride()` in stack:

```ts
middleware: [formData(), methodOverride(), ...]
```

---

## 9. Hidden Grid-State Fields Must Be in Schema

**Problem**: Adding a hidden field to the form without mirroring it in `clientSaveSchema` means `s.parse()` won't return it.

**Solution**: Schema field name must match form input name:

```ts
// Schema: _filter: f.field(s.defaulted(s.string(), ''))
// Form:   <input type="hidden" name="_filter" value={filter} />
```

---

## 📂 Codebase References

- **Controller**: `app/actions/client/controller.tsx` — s.parse with try/catch, 6 actions
- **fragmentResponseInit**: `app/middleware/render.tsx` — Cache-Control helper
- **Schema**: `app/data/schema.ts` — `clients` table with `beforeWrite`
- **Grid**: `app/actions/client/grid-page.tsx` — URL builders, DelButton
- **Edit form**: `app/actions/client/edit-page.tsx` — RestfulForm PUT
- **Create form**: `app/actions/client/create-page.tsx` — RestfulForm POST
- **RestfulForm**: `app/ui/restful-form.tsx` — Form component
- **Router**: `app/router.ts` — Middleware stack order

## Related

- [Form Ergonomics](../concepts/form-ergonomics.md) — RestfulForm + methodOverride + data-schema
- [Inline CRUD Pattern](../guides/inline-crud-pattern.md) — Sidebar edit/create pattern
- [Frame CRUD Pattern](../guides/frame-crud-pattern.md) — How to avoid these issues
- [Pagination/Sort Utils](../lookup/pagination-sort-utils.md) — Utility functions
