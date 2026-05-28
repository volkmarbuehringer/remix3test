<!-- Context: development/remix3/errors/schema-validation | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# Schema Validation Errors

## Problem

`DATA_TABLE_VALIDATION_ERROR` when updating only some columns.

```
DataTableValidationError: Invalid value for column "status" in table "items"
```

## Cause

Schema validation checks fields on update operations even when they're not being updated.

```typescript
// ❌ Wrong - validates on update even when field not provided
validate({ operation, value }) {
  if (!value.status || !['draft', 'published', 'archived'].includes(value.status)) {
    issues.push({ message: 'Invalid status', path: ['status'] })
  }
}
```

## Solution

Only validate fields that are relevant to the operation.

```typescript
// ✅ Correct - validate only on create, or check if field is provided
validate({ operation, value }) {
  // Title required only on create
  if (operation === 'create' && !value.title) {
    issues.push({ message: 'Title is required.', path: ['title'] })
  }

  // Status only on create (updates may not include it)
  if (operation === 'create' && (!value.status || !['draft', 'published', 'archived'].includes(value.status))) {
    issues.push({ message: 'Status must be draft, published, or archived.', path: ['status'] })
  }
}
```

## Alternative: Partial Update Validation

If you need field-level validation on updates, use `beforeWrite` to add defaults:

```typescript
beforeWrite({ operation, value }) {
  let next = { ...value }
  if (operation === 'update' && next.status === undefined) {
    // Don't validate - field not being updated
  }
  return { value: next }
}
```

## Key Points

- Validate required fields only on `create` operations
- Use `operation` parameter to scope validation
- Partial updates may not include all fields
- Error `issues[0]?.message` gives human-readable error for toasts
