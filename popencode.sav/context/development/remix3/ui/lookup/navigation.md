# Lookup: Navigation

**Purpose**: Quick reference for navigation, links, and head management.

**Navigation**:
- Real anchors for normal document navigation
- `navigate(href, options)` for app-driven navigation
- `link(href, options)` mixin for non-anchor navigation

**Runtime Attributes**:
- `rmx-target`
- `rmx-src`
- `rmx-document`

**Head Management**:
```tsx
function App() {
  return () => (
    <html>
      <head>
        <title>Dashboard</title>
        <meta name="description" content="Team dashboard" />
        <link rel="stylesheet" href="/styles/app.css" />
      </head>
      <body>
        <main>...</main>
      </body>
    </html>
  )
}
```

**Rules**:
- Put `title`, `meta`, `link`, `style` in explicit `<head>`
- Treat `<head>` as part of rendered UI tree
- Content outside `<head>` stays in place

**Reference**: [packages/component/docs](https://github.com/remix-run/remix/tree/main/packages/component/docs)

**Related**: `concepts/hydration-frames.md`, `lookup/host-elements.md`