<!-- Context: ui/web/design/concepts | Priority: high | Version: 1.1 | Updated: 2026-04-03 -->

# Concept: Fluid Typography & Compact Tables

**Purpose**: Make UI components respect browser font size while fitting more content on screen

**Last Updated**: 2026-04-03

---

## Core Idea

Use CSS `clamp()` with `rem`/`em` units for fluid typography that respects user preferences while maintaining usability bounds. Combine with compact spacing for data-dense views.

---

## Key Points

- Use `rem` units — respect browser base font setting
- Use `clamp(min, preferred, max)` — fluid sizing with bounds
- Use `em` for padding/gaps — scale proportionally with text
- Use CSS variables for configurable bounds
- Maintains WCAG 1.4.4 (Resize Text) compliance

---

## Quick Example: Fluid Pagination

```css
.pagination {
  --pagination-fs-min: 0.8125rem;
  --pagination-fs-pref: 0.9375rem;
  --pagination-fs-max: 1.125rem;
  
  font-size: clamp(
    var(--pagination-fs-min),
    var(--pagination-fs-pref),
    var(--pagination-fs-max)
  );
  
  margin-top: 0.5rem;
  padding: 0.5rem 0;
}

.pagination__btn {
  padding: 0.5em 0.75em;
  min-width: 2.5em;
  min-height: 2.5em;
}
```

---

## Quick Example: Compact Tables

```css
/* Global table spacing */
table th {
  padding: var(--spacing-xs) var(--spacing-sm);
}

table td {
  padding: var(--spacing-xs) var(--spacing-sm);
}

/* Compact variant for admin grids */
.table-compact {
  --table-compact-padding-y: 0.25rem;
  --table-compact-padding-x: 0.5rem;
  --table-compact-font-size: var(--font-size-fluid-sm);
}

.table-compact,
.table-compact th,
.table-compact td {
  font-size: var(--table-compact-font-size);
  padding: var(--table-compact-padding-y) var(--table-compact-padding-x);
}
```

---

## Mobile Responsive Tables

```css
@media (max-width: 768px) {
  .table-compact td {
    padding: 0.5rem 0.5rem 0.5rem 40%;
    min-height: 1.25em;
  }
  
  .table-compact td::before {
    top: 0.5rem;
    left: 0.5rem;
    right: 0.5rem;
    width: 35%;
    font-size: 0.7rem;
    font-weight: 600;
    text-align: right;  /* Right-aligned for more text space */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
```

---

## Real-World Usage (Bookstore)

| Component | File | Technique |
|-----------|------|-----------|
| Pagination | `app/ui/pagination.tsx` | CSS class + fluid CSS |
| Compact tables | `public/styles/theme.css` | `.table-compact` class |
| Global table | `app/styles/tokens-variables.css` | Reduced spacing tokens |

---

## Reference

- [MDN: CSS values and units](https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Values_and_units)
- [WCAG 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG21/Understanding/resize-text)

---

## Related

- examples/fluid-pagination.md
- examples/compact-tables.md
