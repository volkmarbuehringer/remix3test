# Navbar Active Route Highlighting

**Date**: 2026-04-29
**Project**: Bookstore Demo
**Status**: Approved

## Problem

The bookstore navbar (in `app/ui/layout.tsx`) renders navigation links as plain `<a>` tags with no indication of which route the user is currently on. There is no active-route state, making navigation confusing in a multi-section app (Home, Books, Chat, Agent, Admin, etc.).

## Solution

Use Remix 3's `getContext()` from `remix/async-context-middleware` to access the current request URL inside the `Layout()` component's render function. Compare each link's path against `currentPath` using an `isActive()` helper and conditionally apply a `nav-active` CSS class.

## Architecture

### File Changes

| File | Change |
|------|--------|
| `app/ui/layout.tsx` | Add `import { getContext }`; add path tracking + `isActive()` helper; apply `nav-active` class to active link |
| `public/app.css` | Add `.nav-active` styles |

### Active Route Logic

```typescript
// Inside Layout()'s render function
let currentPath = ''
try {
  let context = getContext()
  currentPath = new URL(context.request.url).pathname
} catch { /* SSR-only */ }

let isActive = (path: string) => {
  if (!currentPath) return false
  if (currentPath === path) return true
  return currentPath.startsWith(path + '/')
}
```

The `try/catch` handles environments where `getContext()` may not be available (testing, error boundaries).

### Prefix Matching for Sub-routes

`currentPath.startsWith(path + '/')` ensures that:
- `/books/genre/fiction` → highlights "Books"
- `/account/settings` → highlights "Account"
- `/admin/books/new` → highlights "Admin"
- `/` (Home) → exact match only (exact check runs first, so `/` won't match everything)

### CSS

```css
.nav-active {
  background: rgba(255, 255, 255, 0.2);
  font-weight: 600;
  border-bottom: 2px solid #fff;
}
```

Matches the existing dark header (`#2c3e50`). The semi-transparent highlight works on both light and dark themes.

### Link Application

Each `<a>` in the `<nav>` gets:
```typescript
<a href={routes.<section>.href()} class={isActive(routes.<section>.href()) ? 'nav-active' : undefined}>
```

The Logout form button is excluded (it's a `<button>` in a `<form>`, not a nav link).

## How It Solves the Server-Render Problem

Every page navigation in Remix 3 is a full HTTP request. The server always knows the current URL via `getContext().request.url`. The active state is calculated fresh on every render — there is no stale client state to manage.

## Files Changed

1. **`app/ui/layout.tsx`** — ~10 lines added (import + path tracking + isActive)
2. **`public/app.css`** — ~8 lines added (.nav-active styles)
