<!-- Context: project-intelligence/bookstore/concepts | Priority: high | Version: 1.0 -->

# SSR Form Patterns

## Core Concept

In Remix 3 server-side rendered (SSR) applications, form elements follow standard HTML patterns rather than React's controlled component patterns. This is a fundamental difference from client-side React apps.

## Key Differences from React

| Pattern | React (Client) | Remix 3 (SSR) |
|---------|----------------|---------------|
| Select value | `value` prop on `<select>` | `selected` prop on `<option>` |
| Input value | `value` prop controlled | `value` attribute (static) |
| Form state | useState hooks | Server-rendered values |
| Updates | onChange handlers | Form submission + re-render |

## The Select Pattern

### Incorrect (React Style)
```tsx
<select value={String(user.pagesize ?? 20)}>
  <option value="10">10</option>
  <option value="20">20</option>
</select>
```

### Correct (SSR Style)
```tsx
<select id="pagesize" name="pagesize">
  <option value="10" selected={user.pagesize === 10}>10</option>
  <option value="20" selected={user.pagesize === 20}>20</option>
</select>
```

## Why This Matters

1. **Server Rendering**: HTML is generated server-side, not client-side
2. **Progressive Enhancement**: Forms work without JavaScript
3. **Hydration Match**: SSR HTML must match what client expects
4. **Standard HTML**: Uses native HTML `selected` attribute behavior

## Codebase Examples

- `app/controllers/account/settings/page.tsx` - Pagesize dropdown
- `app/controllers/admin/books/index-page.tsx` - Genre filter
- `app/controllers/admin/users/form.tsx` - Role selection
- `app/controllers/admin/orders/index-page.tsx` - Status filter
- `app/controllers/admin/books/form.tsx` - In-stock boolean

## Related Patterns

- [Select Element Examples](../examples/select-element-pattern.md)
- [Form Troubleshooting](../errors/select-value-bug.md)
