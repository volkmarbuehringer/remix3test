<!-- Context: development/remix3/guides/layout | Priority: high | Version: 1.3 | Updated: 2026-04-12 -->

# Layout Guide

Grid-based sidebar layout with responsive design.

## Core Concept

Use CSS Grid for sidebar layout: fixed sidebar on desktop, collapsible on mobile. Include breadcrumbs, toast notifications, and proper ARIA attributes.

---

## Key Points

- **Grid**: `gridTemplateColumns: '280px minmax(0, 1fr)'`
- **Mobile**: `@media (max-width: 768px)` collapses to single column
- **Components**: Sidebar nav, main content area, breadcrumbs
- **Logout**: POST form for security

---

## Minimal Example

```typescript
let appShellStyle = css({
  height: '100vh',
  display: 'grid',
  gridTemplateColumns: '280px minmax(0, 1fr)',
  '@media (max-width: 768px)': { gridTemplateColumns: '1fr' },
})

let sidebarStyle = css({
  background: '#f5f5f5',
  padding: '1rem',
})

let mainStyle = css({
  padding: '1rem',
  overflow: 'auto',
})
```

---

## Reference

- Design system: `guides/design-system.md`
- Breadcrumbs: `guides/breadcrumbs.md`
- Responsive: `lookup/responsive-tables.md`
