<!-- Context: bookstore-demo/guides | Priority: high | Version: 1.0 | Updated: 2026-04-29 -->

# Guide: Navbar Active Route with getContext()

**Purpose**: Server-rendered navigation highlighting using `getContext()` from `remix/async-context-middleware` to read the current request URL, with auth-conditional items and form-based POST logout.

---

## Core Idea

The `Layout()` component extracts the current `pathname` from `getContext().request.url` during SSR and compares it against each nav link's route to conditionally apply a `nav-active` CSS class. Theme toggle lives outside `<nav>` in the `<h1>` row. Logout uses `<form method="POST">` (never a GET link) with styled danger button.

---

## Key Points

- **`getContext()` for URL**: Call `getContext()` inside render phase (inner function), wrapped in try/catch — only available during SSR, throws if called outside a request
- **`isActive()` helper**: `currentPath === path || currentPath.startsWith(path + '/')` — exact match or sub-route prefix match
- **`routes.*.href()`** for all nav link URLs — not hardcoded path strings
- **Auth-conditional rendering**: `getCurrentUserSafely()` returns `User | null`; branch on `user` and `user.role === 'admin'`
- **Logout**: `<form method="POST" action={routes.auth.logout.href()}>` with `<button type="submit" class="nav-logout">` — styled with danger colors
- **Theme toggle**: `<button id="theme-toggle">` inside `<h1>` alongside the site title link — NOT in `<nav>` — avoids visual clutter and keeps it with branding
- **No skip link**: Bookstore layout omits the skip-link pattern present in the generic guide

---

## Implementation

```tsx
// bookstore/app/ui/layout.tsx
export function Layout() {
  return ({ title, children }: LayoutProps) => {
    let user = getCurrentUserSafely()

    let currentPath = ''
    try {
      let context = getContext()
      currentPath = new URL(context.request.url).pathname
    } catch { /* SSR-only — ignored outside request */ }

    let isActive = (path: string) => {
      if (!currentPath) return false
      if (currentPath === path) return true
      return currentPath.startsWith(path + '/')
    }

    return (
      <Document title={title}>
        <header>
          <div class="container">
            <h1>
              <a href={routes.home.href()}>📚 Bookstore</a>
              <button id="theme-toggle" aria-label="Toggle dark mode">🌓</button>
            </h1>
            <nav>
              <a href={routes.home.href()} class={isActive(routes.home.href()) ? 'nav-active' : undefined}>Home</a>
              <a href={routes.books.index.href()} class={isActive(routes.books.index.href()) ? 'nav-active' : undefined}>Books</a>
              {/* ... public nav items ... */}
              <a href={routes.cart.index.href()} class={isActive(routes.cart.index.href()) ? 'nav-active' : undefined}>Cart</a>

              {user ? (
                <>
                  <a href={routes.account.index.href()} class={...}>Account</a>
                  {user.role === 'admin' ? <a href={routes.admin.index.href()} class={...}>Admin</a> : null}
                  <form method="POST" action={routes.auth.logout.href()}>
                    <button type="submit" class="nav-logout">Logout</button>
                  </form>
                </>
              ) : (
                <>
                  <a href={routes.auth.login.index.href()} class={...}>Login</a>
                  <a href={routes.auth.register.index.href()} class={...}>Register</a>
                </>
              )}
            </nav>
          </div>
        </header>
        <main><div class="container">{children}</div></main>
        <footer>...</footer>
      </Document>
    )
  }
}
```

---

## CSS Classes

### `nav-active` — active nav link
```css
nav a.nav-active {
  background: var(--rmx-surface-lvl2);
  font-weight: 600;
  color: var(--rmx-color-text-primary);
  border-bottom: 2px solid var(--rmx-color-action-primary-background);
}
```

### `nav-logout` — POST logout button
```css
nav button.nav-logout {
  color: var(--rmx-color-action-danger-background);
  opacity: 0.85;
}
nav button.nav-logout:hover {
  background: var(--rmx-color-action-danger-background);
  color: var(--rmx-color-action-danger-foreground);
  opacity: 1;
}
```

---

## 📂 Codebase References

**Implementation**:
- `bookstore/app/ui/layout.tsx` — Full Layout component with `getContext()`, `isActive()`, auth-conditional nav, logout form, theme toggle
- `bookstore/app/assets/app.css` — `nav-active` and `nav-logout` CSS classes (lines 78-102)
- `bookstore/app/utils/context.ts` — `getCurrentUserSafely()` and `getCurrentUser()` helpers
- `bookstore/app/ui/document.tsx` — Theme toggle event delegation + SSR `data-theme` attribute

**Related context**:
- `../../development/remix3/guides/layout-active-navigation.md` — Generic layout pattern (skip link variant)
- `../../development/remix3/concepts/theme-switching.md` — Three-layer dark mode architecture
- `concepts/theme-css-architecture.md` — How tokens flow through CSS variables
- `../../development/remix3/guides/typed-context.md` — `getContext()` module augmentation
