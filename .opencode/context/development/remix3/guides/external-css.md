<!-- Context: development/remix3/guides/external-css | Priority: high | Version: 1.0 | Updated: 2026-04-17 -->

# External CSS with Design Tokens

Organize external CSS with design tokens (CSS custom properties) for consistent styling.

## Core Concept

External CSS file in `public/` directory with design tokens (CSS custom properties) as the foundation. Components reference tokens via `var(--token-name)` for consistency and easy theming.

## Key Points

- **Design tokens**: CSS custom properties for colors, spacing, typography, shadows
- **File location**: `public/app.css` served at `/app.css`
- **Organization**: Tokens → Reset → Base → Components → Utilities → Responsive
- **Accessibility**: Focus-visible styles, skip links, reduced motion support
- **Responsive**: Breakpoints at 640px, 768px, 1024px

## CSS Structure

```css
/* 1. Design Tokens */
:root {
  /* Colors */
  --primary: #FF385C;
  --primary-hover: #E31C5F;
  --color-text: #222222;
  --color-text-muted: #717171;
  --color-border: #D8D8D8;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;

  /* Typography */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-weight-medium: 500;
}

/* 2. Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* 3. Base Styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  color: var(--color-text);
  background: #ffffff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 4. Components */
.btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.btn-primary {
  background: var(--primary);
  color: #fff;
}
.btn-secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

/* 5. Responsive */
@media (min-width: 640px) { /* mobile */ }
@media (min-width: 768px) { /* tablet */ }
@media (min-width: 1024px) { /* desktop */ }
```

## Linking CSS

```typescript
// app/ui/document.tsx
import type { Handle } from 'remix/ui'

export function Document(handle: Handle<{ children: any }>) {
  return () => {
    let { children } = handle.props
    return (
      <html>
        <head>
          <link rel="stylesheet" href="/app.css" />
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
```

## Static File Serving

```typescript
// server.ts - Express-like static serving
const publicPath = path.join(__dirname, 'public')

const server = http.createServer(
  createRequestListener(async (request) => {
    let url = new URL(request.url)
    
    // Check for static file
    let filePath = path.join(publicPath, url.pathname)
    try {
      let stats = await fs.promises.stat(filePath)
      if (stats.isFile()) {
        let content = await fs.promises.readFile(filePath)
        return new Response(content, {
          headers: { 'Content-Type': getContentType(filePath) },
        })
      }
    } catch { /* continue to router */ }
    
    return await router.fetch(request)
  }),
)
```

## Reference

- CSS file: `checker/public/app.css` (688 lines)
- Layout: `checker/app/ui/layout.tsx`
- Server: `checker/server.ts`

## Related

- `lookup/static-file-serving.md` - Static file rules
- `guides/design-system.md` - Design tokens concept
- `guides/layout-active-navigation.md` - Layout patterns