# Guide: Breadcrumbs

**Core Idea**: Navigation trail showing current location. Place inside main content, NOT sidebar.

## Component

```tsx
import type { Handle } from 'remix/ui'

type BreadcrumbsProps = {
  items: Array<{ label: string; href?: string }>
}

export function Breadcrumbs(handle: Handle<BreadcrumbsProps>) {
  return () => {
    let { items } = handle.props
    return (
      <nav aria-label="Breadcrumb">
        <ol>
          {items.map((item, i) => (
            <li key={i}>
              {i > 0 && <span>/</span>}
              {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
    )
  }
}
```

## Usage

```tsx
<Breadcrumbs items={[
  { label: 'Home', href: routes.home.href() },
  { label: 'Admin', href: routes.admin.href() },
  { label: 'Books', href: routes.admin.books.href() },
  { label: 'Edit Book' }, // current - no href
]} />
```
