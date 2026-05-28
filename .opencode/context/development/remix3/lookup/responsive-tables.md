<!-- Context: development/remix3/lookup/responsive-tables | Priority: medium | Version: 1.1 | Updated: 2026-04-01 -->

# Responsive Tables

Transform tables to card layout on mobile using CSS.

## Core Concept
On small screens, transform table rows into stacked cards with labels shown via `data-label` attributes.

## HTML Structure
```tsx
<td data-label="Name">{value}</td>
<td data-label="Actions" class="actions">...</td>
```

## Responsive Table Wrapper
```tsx
<div mix={tableWrapperStyle}><table mix={tableStyle}>{/* ... */}</table></div>
const tableWrapperStyle = css({ overflowX: 'auto', '@media (max-width: 767px)': { /* Mobile overrides */ } })
```

## CSS Pattern (Remix CSS-in-JS)
```typescript
const tableStyle = css({
  width: '100%', borderCollapse: 'collapse', marginTop: '1rem',
  '@media (max-width: 767px)': {
    '& thead': { display: 'none' },
    '& tbody tr': { display: 'block', marginBottom: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' },
    '& td': { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9',
      '&::before': { content: 'attr(data-label)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' } },
    '& td:last-child': { justifyContent: 'flex-start', gap: '0.5rem', paddingTop: '1rem', '&::before': { display: 'none' } },
  },
})
```

## Key Points
- Labels via `data-label`, displayed with `::before`; uppercase with letter-spacing on mobile
- Action column: hide label, show buttons in a row with gap
- Wrap table in `overflowX: 'auto'` for horizontal scroll if needed

## Text Truncation with Tooltip
For long text columns, truncate with ellipsis and show full text on hover:
```tsx
<td data-label="Description" title={description || ''}>
  {description ? description.length > 50 ? description.slice(0, 50) + '…' : description : '-'}
</td>
```
Use `title` attribute for native tooltip; truncate at 50 chars with "…"; show "-" for empty.

## Column Stability (Pagination/Sorting)
Table columns may "jump" during pagination if widths are not explicitly set. Add explicit widths to `<th>`:
```tsx
const columnWidths: Record<string, string> = { id: '60px', title: 'auto', author: '150px', genre: '100px', price: '80px' }
import type { Handle } from 'remix/ui'

export function SortableTH(handle: Handle<SortableTHProps>) {
  return () => {
    let { column, label, sort, filters, baseUrl } = handle.props
    let width = columnWidths[column] ?? 'auto'
    return (<th style={{ width, minWidth: width === 'auto' ? '100px' : width }}>{/* ... */}</th>)
  }
}
```

### Key Points
- Fixed pixels for narrow columns (id, price, actions); `auto` with `minWidth` for flexible content (title)
- Apply the same pattern to static `<th>` elements

### Files Fixed
- `app/controllers/admin/books/index-page.tsx`
- `app/controllers/admin/users/index-page.tsx`

## Related
- guides/layout.md - Sticky footer and breakpoints
