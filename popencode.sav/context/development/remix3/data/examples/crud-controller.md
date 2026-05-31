<!-- Context: development/remix3/examples/crud-controller | Priority: high | Version: 2.0 | Updated: 2026-05-05 -->

# CRUD Controller

Data routes with pagination, breadcrumbs, and forms.

## Route Definition
```typescript
export let routes = route('items', {
  index: get('/'), new: get('/new'), create: post('/'),
  show: get('/:itemId'), edit: get('/:itemId/edit'),
  update: post('/:itemId'), destroy: post('/:itemId/destroy'),
})
```

## Controller
```typescript
export default {
  actions: {
    async index({ db, url }) {
      let page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
      let items = await db.findMany(items, { orderBy: ['created_at', 'desc'], limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      let total = await db.count(items)
      return render(<ItemsListPage items={items} currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} />)
    },
    async create({ db, request }) {
      try { await db.create(items, { title: formData.get('title')?.toString() ?? '' }) }
      catch (error: any) {
        if (error.code === 'DATA_TABLE_VALIDATION_ERROR') return toastRedirect(routes.items.new.href(), error.issues?.[0]?.message, true)
        throw error
      }
      return toastRedirect(routes.items.index.href(), 'Created')
    },
    // update, destroy follow same pattern with page/sort preservation
  },
} satisfies Controller<typeof routes.items>
```

## Key Points
- `PAGE_SIZE` constant for pagination, `Math.max(1, ...)` for invalid pages
- Always preserve `page` in redirects after edit/delete
- Use `toastRedirect()` for success/error feedback
- For sort preservation: `buildBackUrl(routes.items.index.href(), page, sort)`

## Reference
- Toast pattern: `../../ui/concepts/toast-system.md`
- Pagination: `../../guides/pagination.md`
- Form patterns: `../../guides/form-patterns.md`
