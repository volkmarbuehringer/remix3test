# Error: PostgreSQL FK Constraint Not Handled

**Symptom**: 500 error when deleting a record with foreign key dependencies

**Cause**: PostgreSQL throws error code `23503` for foreign key constraint violations. The adapter wraps it as `DATA_TABLE_ADAPTER_ERROR`.

**Error Structure**:

```typescript
{
  code: 'DATA_TABLE_ADAPTER_ERROR',
  cause: {
    code: '23503',  // PostgreSQL FK violation
    detail: 'Key (id)=(100) is still referenced from table "order_items"'
  }
}
```

**Fix**: Wrap delete in try-catch and check error codes:

```typescript
async destroy({ get, params, url }) {
  let db = get(Database)
  let bookId = parseId(params.bookId)
  let book = bookId === undefined ? undefined : await db.find(books, bookId)

  let redirectUrl = buildBackUrl(routes.admin.books.index.href(), page, sort)

  if (!book) {
    return toastRedirect(redirectUrl, 'Book not found', true)
  }

  try {
    await db.delete(books, book.id)
  } catch (error: any) {
    // Check for FK constraint violation (PostgreSQL 23503)
    if (error.code === 'DATA_TABLE_ADAPTER_ERROR' && error.cause?.code === '23503') {
      return toastRedirect(redirectUrl, 'Cannot delete: has associated orders', true)
    }
    throw error  // Re-throw unexpected errors
  }

  return toastRedirect(redirectUrl, 'Book deleted')
}
```

**Key Point**: Always check `error.cause?.code` for wrapped adapter errors.

**Reference**: `guides/data-route-checklist.md`
