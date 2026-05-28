# Example: Zebra Striping

**Core Idea**: Alternating row backgrounds for table readability.

## CSS

```css
table {
  width: 100%;
  border-collapse: collapse;
}
table th {
  background-color: var(--color-background-muted);
  font-weight: var(--font-weight-semibold);
}
table td {
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: var(--border-width) solid var(--color-border);
}
/* Alternating rows */
table tr:nth-child(even) {
  background-color: var(--color-background-subtle);
}
table tr:hover {
  background-color: var(--color-background-hover);
}
```

**Reference**: `bookstore/public/app.css` (lines 342-351)