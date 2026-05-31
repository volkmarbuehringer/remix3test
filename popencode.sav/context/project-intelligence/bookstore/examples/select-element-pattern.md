<!-- Context: project-intelligence/bookstore/examples | Priority: high | Version: 1.0 -->

# Select Element Pattern

## Correct Pattern

Use `selected` prop on individual `<option>` elements based on condition:

```tsx
<select id="role" name="role">
  <option value="customer" selected={user.role === 'customer'}>
    Customer
  </option>
  <option value="admin" selected={user.role === 'admin'}>
    Admin
  </option>
</select>
```

## Filter Dropdown Example

```tsx
<select id="genre" name="genre">
  <option value="" selected={!filters.genre}>
    All Genres
  </option>
  <option value="Fiction" selected={filters.genre === 'Fiction'}>
    Fiction
  </option>
  <option value="Non-Fiction" selected={filters.genre === 'Non-Fiction'}>
    Non-Fiction
  </option>
</select>
```

## Boolean Select Example

```tsx
<select id="inStock" name="inStock">
  <option value="true" selected={book?.in_stock ?? true}>
    Yes
  </option>
  <option value="false" selected={book != null ? !book.in_stock : false}>
    No
  </option>
</select>
```

## Common Bug Pattern

### Wrong (React-style)
```tsx
// ❌ This doesn't work in SSR - always shows first option
<select value={String(user.pagesize ?? 20)}>
  <option value="10">10</option>
  <option value="20">20</option>
  <option value="50">50</option>
  <option value="100">100</option>
</select>
```

### Right (SSR-style)
```tsx
// ✅ Each option checks if it should be selected
<select id="pagesize" name="pagesize">
  <option value="10" selected={user.pagesize === 10}>10</option>
  <option value="20" selected={user.pagesize === 20}>20</option>
  <option value="50" selected={user.pagesize === 50}>50</option>
  <option value="100" selected={user.pagesize === 100}>100</option>
</select>
```

## Codebase References

| File | Pattern |
|------|---------|
| `app/controllers/account/settings/page.tsx:32-37` | Pagesize user setting |
| `app/controllers/admin/books/index-page.tsx:61-79` | Genre filter dropdown |
| `app/controllers/admin/users/form.tsx:42-49` | Role selection form |
| `app/controllers/admin/orders/index-page.tsx:50-65` | Status filter dropdown |
| `app/controllers/admin/books/form.tsx:110-117` | In-stock boolean |

## Related

- [SSR Form Concepts](../concepts/ssr-form-patterns.md)
- [Form Troubleshooting](../errors/select-value-bug.md)
