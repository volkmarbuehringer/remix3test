<!-- Context: development/remix3/guides/layout-active-navigation | Priority: high | Version: 1.0 | Updated: 2026-04-17 -->

# Layout with Active Navigation

Layout pattern with active navigation highlighting, skip link, and footer.

## Core Concept

Layout component that tracks current path from request context, applies `nav-active` class to highlight current route. Includes keyboard accessibility with skip link and consistent footer.

## Key Points

- **Path tracking**: Extract `pathname` from `context.request.url` in layout
- **Active check**: Use `isActive()` helper for exact match or sub-route matching
- **Skip link**: First focusable element, hidden until focused (appears on Tab)
- **Logout**: POST form for security (not GET)
- **Footer**: Container wrapper with copyright year

## Implementation

```typescript
// app/ui/layout.tsx
import type { Handle } from 'remix/ui'

type LayoutProps = {
  children: any
}

export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { children } = handle.props
    // Get current path from request context
    let currentPath = ''
    try {
      let context = getContext()
      if (context?.request) {
        currentPath = new URL(context.request.url).pathname
      }
    } catch { /* ignore */ }

    // Helper for nav highlighting
    let isActive = (path: string) => {
      if (!currentPath) return false
      return currentPath === path || currentPath.startsWith(path + '/')
    }

    return (
      <Document>
        {/* Skip link - hidden until focused */}
        <a href="#main-content" class="skip-link">
          Skip to main content
        </a>
        <header>
          <nav>
            <a href={routes.home.href()} class={isActive(routes.home.href()) ? 'nav-active' : undefined}>
              Home
            </a>
            {/* ... more nav links */}
            {user && (
              <form method="POST" action={routes.auth.logout.href()}>
                <button type="submit" class="btn btn-secondary">Logout</button>
              </form>
            )}
          </nav>
        </header>
        <main id="main-content">
          <div class="container">{children}</div>
        </main>
        <footer>
          <div class="container">
            <p>&copy; {new Date().getFullYear()} AppName.</p>
          </div>
        </footer>
      </Document>
    )
  }
}
```

## CSS Classes

```css
/* Skip link - appears on focus */
.skip-link {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.skip-link:focus {
  position: static;
  width: auto;
  height: auto;
  padding: 1rem;
  background: var(--color-background);
  z-index: 9999;
}

/* Active navigation */
.nav-active {
  font-weight: var(--font-weight-semibold);
  color: var(--primary);
  border-bottom: 2px solid var(--primary);
}

/* Footer */
footer {
  padding: var(--spacing-lg) 0;
  border-top: 1px solid var(--color-border);
  text-align: center;
  color: var(--color-text-muted);
}
```

## Reference

- Full layout: `checker/app/ui/layout.tsx`
- CSS: `checker/public/app.css`
- Static serving: `lookup/static-file-serving.md`

## Related

- `guides/layout.md` - Grid-based layout
- `guides/design-system.md` - Design tokens
- `concepts/css-class-mapping.md` - CSS class patterns