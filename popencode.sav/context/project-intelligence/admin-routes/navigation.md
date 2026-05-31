<!-- Context: project-intelligence/admin-routes | Priority: high | Version: 1.1 | Updated: 2026-04-29 -->

# Admin Route Patterns

**Purpose**: Standardized patterns for building admin CRUD index pages in the Remix 3 bookstore project.

## Quick Reference

| Topic | File |
|-------|------|
| **Shared Components** | `concepts/shared-components.md` |
| **Styling Standards** | `guides/styling-guide.md` |
| **Migration Checklist** | `guides/migration-checklist.md` |

## Admin Index Page Structure

```
Layout
├── AdminPageHeader (title + description)
├── AdminFilterForm (search + dropdown filter)
├── AdminTableCard (table + pagination + empty state)
└── Action links (Add New, Back to Dashboard)
```

**Reference**: `bookstore/app/controllers/admin/books/index-page.tsx`

## Core Files

| File | Purpose |
|------|---------|
| `app/ui/admin-page-header.tsx` | Reusable page title + description |
| `app/ui/admin-filter-form.tsx` | Search input + select filter + submit |
| `app/ui/admin-table-card.tsx` | Table wrapper with pagination and empty state |
| `app/ui/badge.tsx` | Status badge with semantic color variants |
| `app/controllers/admin/styles.ts` | Shared admin-specific `css()` mixins |
| `app/controllers/admin/utils.ts` | Sort/filter parsing, URL builders |
| `app/ui/theme.tsx` | Theme contract (`tokens.ts` → `remix/ui/theme`) |

## Key Principles

- **No class-based styling** — use `css()` mixins
- **No hardcoded colors** — use `theme.*` from `remix/ui/theme`
- **Zebra striping** — alternating row colors in data tables
- **Accent color** — admin uses `#FF385C` for buttons/focus
- **Sortable columns** — use `<SortableTH>` from `app/ui/table.tsx`
- **Filter preservation** — sort and filter state persist across pagination

## Related Context

- **Remix 3 UI**: `../../development/remix3/navigation.md`
- **CSS Mixins**: `../../development/remix3/guides/css-mixins.md`
- **Token Migration**: `../../development/remix3/lookup/token-migration.md`
- **Theme Switching**: `../../development/remix3/concepts/theme-switching.md`
- **Code Quality**: `../../core/standards/concepts/code-quality.md`
