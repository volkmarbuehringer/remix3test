<!-- Context: project-intelligence/bookstore | Priority: high | Version: 2.3 | Updated: 2026-05-16 -->

# Bookstore Context Index

## Overview
Remix 3 e-commerce app with auth, cart, admin grids, PostgreSQL (via `remix/data-table` + `remix/data-table-postgres`).

## Structure

```
bookstore/
├── concepts/          # Core concepts
├── guides/           # How-to guides
├── examples/         # Working patterns
├── lookup/           # Quick reference
└── errors/           # Common issues
```

## Quick Reference

| Item | Details |
|------|---------|
| Port | 44100 |
| Users | admin@bookstore.com / customer@example.com |
| Books | 100 seeded (SQLite was 128) |
| Tests | ~62 unit/integration + 2 E2E Playwright |
| DB | PostgreSQL via raw SQL (no migrations) |

## PostgreSQL Migration (2026-05-08)

| File | Description |
|------|-------------|
| [PostgreSQL Compatibility](./concepts/postgresql-compatibility.md) ✨ NEW | BIGINT/DECIMAL/BOOLEAN type handling |
| [Raw SQL Table Creation](./concepts/raw-sql-table-creation.md) ✨ NEW | CREATE TABLE IF NOT EXISTS pattern |
| [Migration Patterns](./guides/postgresql-migration-patterns.md) ✨ NEW | SQLite→PostgreSQL step-by-step |
| [Database Reference](./lookup/postgresql-database-reference.md) ✨ NEW | Tables, seed data, connection details |
| [PostgreSQL Gotchas](./errors/postgresql-gotchas.md) ✨ NEW | Boolean coercion, DECIMAL strings, BIGINT strings |
| [Testing Guide](./guides/testing.md) ↑ UPDATED | PostgreSQL test patterns (hasTable, dynamic slugs) |
| [Database Config](./guides/database-config.md) ↑ UPDATED | Raw SQL setup, no migrations |

## Key Patterns (Existing)

- [Component Factory](./concepts/overview.md)
- [Form Component Library](./concepts/form-components.md)
- [SSR Form Patterns](./concepts/ssr-form-patterns.md)
- [Form Organization](./guides/form-organization.md)
- [UI Styling](./guides/ui-styling.md) ↑ UPDATED — Now uses createTheme() token system
- [Theme Token System](./concepts/theme-setup.md) ✨ NEW — Typed design tokens via createTheme()
- [Token Mapping Reference](./lookup/quick-reference.md) ↑ UPDATED — Hardcoded→token lookup table
- [Editable Grids](./examples/editable-grid-pattern.md)
- [Select Element Pattern](./examples/select-element-pattern.md)

## Admin UI

- [Admin UI Improvements](./lookup/admin-ui-improvements.md) — Dashboard, breadcrumbs, tables, nav

## Admin Form Examples

- [Book Form](./examples/admin-book-form.md) — Multi-section complex form
- [User Form](./examples/admin-user-form.md) — Simple single-section form
- [Order Item Form](./examples/admin-order-item-form.md) — Read-only + editable fields

## Common Issues

- [PostgreSQL Gotchas](./errors/postgresql-gotchas.md) ✨ NEW — Boolean, DECIMAL, BIGINT, unique constraints
- [Troubleshooting](./errors/troubleshooting.md)
- [Select Value Bug](./errors/select-value-bug.md)
- [Textarea Empty Value](./errors/form-hydration.md)
