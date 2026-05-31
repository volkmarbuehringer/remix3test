<!-- Context: project-intelligence/bookstore/examples | Priority: medium | Version: 1.0 -->

# Editable Grid Pattern

## Concept

Inline-editing data grids where cells become editable on click. Used for admin book/user management.

## Architecture

```
base-editable-grid.tsx    # Reusable generic component
admin-books-grid.tsx      # Book-specific config
admin-users-grid.tsx      # User-specific config
```

## Column Config

```typescript
const columns: ColumnConfig[] = [
  { label: 'ID', dataKey: 'id', editable: false },
  { label: 'Title', dataKey: 'title', editable: true, type: 'text' },
  { label: 'Price', dataKey: 'price', editable: true, type: 'number',
    format: (v) => '$' + (v as number).toFixed(2) },
  { label: 'Stock', dataKey: 'in_stock', editable: true, type: 'toggle' },
]
```

## Save Handler

```typescript
function handleSave(id: number, field: string, value: unknown): Promise<Response> {
  if (field === 'title') {
    return fetch(routes.admin.books.updateTitle.href({ bookId: id }), {
      method: 'POST',
      body: JSON.stringify({ title: String(value) }),
    })
  }
  // ...
}
```

## Toggle Handler

```typescript
function handleToggle(id: number, field: string): Promise<Response> {
  return fetch(routes.admin.books.updateStock.href({ bookId: id }), {
    method: 'POST',
    body: JSON.stringify({ in_stock: field === 'in_stock' }),
  })
}
```

## Props Transform

```typescript
function transformProps(props: AdminBooksGridProps): BaseEditableGridProps {
  return {
    items: props.books,
    columns,
    getId: (book) => book.id,
    getRowActions: (book) => getRowActions(book, props.page, ...),
    onSave: handleSave,
    onToggle: handleToggle,
    filterQs: props.filterQs,
  }
}
```

## E2E Selectors

```typescript
// Click cell to edit
await page.click('td[data-label="Title"]')

// Fill new value
await page.fill('input[data-input^="title-input-"]', 'New Title')

// Save/Cancel
await page.click('button:has-text("Save")')
await page.click('button:has-text("Cancel")')
```
