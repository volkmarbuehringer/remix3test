<!-- Context: bookstore-demo/concepts/user-preferences | Priority: high | Version: 1.0 | Created: 2026-04-24 -->

# User Preferences Pattern

**Core Concept**: Store user-specific settings in the users table and apply them as defaults in controllers that support pagination.

---

## Pattern Overview

This pattern stores user preferences (like `pagesize`) in the users table, provides a settings UI for users to configure them, and applies those preferences in list-based controllers.

### When to Use

- User-specific pagination (`pagesize`)
- User-specific display preferences
- User-specific notification settings

---

## Implementation

### 1. Schema - Add Column with Default

In `bookstore/app/data/schema.ts`:

```typescript
export const users = table({
  name: 'users',
  columns: {
    // ... other columns
    pagesize: c.integer().default(10),  // User preference with default
  },
})
```

**Key**: Use `.default(value)` for schema defaults so new databasesauto-populate correctly.

---

### 2. Settings UI - Add Dropdown

In `bookstore/app/controllers/account/settings/page.tsx`:

```typescript
<div class="form-group">
  <label for="pagesize">Items per page</label>
  <select id="pagesize" name="pagesize">
    <option value="5" selected={user.pagesize === 5}>5</option>
    <option value="10" selected={user.pagesize === 10 || !user.pagesize}>10</option>
    <option value="15" selected={user.pagesize === 15}>15</option>
    <option value="20" selected={user.pagesize === 20}>20</option>
  </select>
</div>
```

**Key**: Provide fallback to default in `selected` check.

---

### 3. Settings Controller - Handle Form Submission

In `bookstore/app/controllers/account/settings/controller.tsx`:

```typescript
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

const pagesizeField = f.field(
  s.defaulted(s.union([s.literal('5'), s.literal('10'), s.literal('15'), s.literal('20')]), '10'),
)

// In form schema
const accountSettingsSchema = f.object({
  // ... other fields
  pagesize: pagesizeField,
})

// In update action
let { email, name, password, pagesize } = s.parse(accountSettingsSchema, formData)
await db.update(users, user.id, { 
  name, 
  email, 
  pagesize: parseInt(pagesize, 10) 
})
```

**Key**: Use `s.union()` with literal values for strict type validation.

---

### 4. List Controller - Use User Preference

In list controllers like `admin/books/controller.tsx`:

```typescript
// Get user's pagesize preference or use default
let user = getCurrentUser()
let pageSize = user.pagesize && user.pagesize > 0 ? user.pagesize : DEFAULT_PAGE_SIZE
let offset = (page - 1) * pageSize

// Use pageSize in query
await db.findMany(books, { limit: pageSize, offset })
```

**Key**: Always validate user's preference (check `> 0`) before using it.

---

## Migration Note

The `pagesize` column already exists in production DB. Schema provides defaults automatically.

For new columns:
- Schema defaults handle new databases
- Run migration for existing databases
- If migration fails, remove it and rely on schema defaults for new entries

---

## Related Context

- [admin-books-fsp.md](../lookup/admin-books-fsp.md) - Filter/sort/pagination
- [pagination.md](../../development/remix3/guides/pagination.md) - Pagination pattern

---

## Codebase References

| Implementation | File |
|----------------|------|
| Schema (users table) | `bookstore/app/data/schema.ts` |
| Settings page | `bookstore/app/controllers/account/settings/page.tsx` |
| Settings controller | `bookstore/app/controllers/account/settings/controller.tsx` |
| Admin books controller | `bookstore/app/controllers/admin/books/controller.tsx` |