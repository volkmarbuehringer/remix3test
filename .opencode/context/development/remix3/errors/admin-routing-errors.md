# Error: HTML Form DELETE Method Not Supported

**Symptom**: 404 error when submitting delete forms

**Cause**: HTML forms only support GET and POST methods. Using `del()` route method doesn't work with browser forms.

**Fix**: Use POST method with `/destroy` suffix path:

```typescript
// routes.ts
// Before (broken)
destroy: del('/books/:bookId')

// After (working)
destroy: post('/books/:bookId/destroy')
```

```typescript
// Form action in component
// Before
action={routes.admin.books.destroy.href({ bookId: book.id })}

// After - includes pagination params
action={
  routes.admin.books.destroy.href({ bookId: book.id }) +
  '?page=' + page + '&sort=' + sortColumn + '&dir=' + sortDir
}
```

**Key Point**: HTML forms = GET/POST only. DELETE/PUT methods require JavaScript fetch.

**Reference**: `guides/form-patterns.md`
