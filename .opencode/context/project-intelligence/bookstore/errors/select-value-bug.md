<!-- Context: project-intelligence/bookstore/errors | Priority: high | Version: 1.0 -->

# Select Value Bug

## Problem

The pagesize dropdown at `/account/settings` always displayed "10" regardless of the user's actual setting from the database.

## Root Cause

The select element was using React-style `value` prop on the `<select>` element, but Remix 3's server-side rendering requires using the `selected` prop on individual `<option>` elements.

## Incorrect Code

```tsx
// ❌ WRONG - React controlled component pattern
<select value={String(user.pagesize ?? 20)}>
  <option value="10">10</option>
  <option value="20">20</option>
  <option value="50">50</option>
  <option value="100">100</option>
</select>
```

## Correct Code

```tsx
// ✅ CORRECT - SSR pattern with selected on options
<select id="pagesize" name="pagesize">
  <option value="10" selected={user.pagesize === 10}>10</option>
  <option value="20" selected={user.pagesize === 20}>20</option>
  <option value="50" selected={user.pagesize === 50}>50</option>
  <option value="100" selected={user.pagesize === 100}>100</option>
</select>
```

## Why It Failed

In Remix 3 SSR:
- HTML is rendered server-side before JavaScript runs
- The `value` prop on `<select>` doesn't work like React's controlled components
- The browser falls back to selecting the first option
- The `selected` attribute on `<option>` is the standard HTML approach

## Affected Files

- **Fixed**: `app/controllers/account/settings/page.tsx`
- **Controller**: `app/controllers/account/settings/controller.tsx`
- **Schema**: `app/data/schema.ts` (users table pagesize field)

## Prevention

### Checklist for Select Elements

- [ ] Use `selected` prop on `<option>` elements, not `value` on `<select>`
- [ ] Each option has a boolean condition checking the current value
- [ ] Include `id` and `name` attributes on the select for form submission
- [ ] Test that the correct option is pre-selected when page loads

### Pattern to Follow

See working examples in the codebase:
- Genre filter: `app/controllers/admin/books/index-page.tsx:61-79`
- Role selection: `app/controllers/admin/users/form.tsx:42-49`
- Status filter: `app/controllers/admin/orders/index-page.tsx:50-65`
- Boolean select: `app/controllers/admin/books/form.tsx:110-117`

## Related Documentation

- [SSR Form Patterns](../concepts/ssr-form-patterns.md)
- [Select Element Examples](../examples/select-element-pattern.md)
