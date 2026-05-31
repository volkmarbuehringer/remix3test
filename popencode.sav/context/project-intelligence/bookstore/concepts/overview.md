<!-- Context: project-intelligence/bookstore/concepts | Priority: high | Version: 1.0 -->

# Bookstore Overview

## Core Concept

Remix 3 (fetch-router) e-commerce app demonstrating auth, session-based cart, inline-editing admin grids, and PostgreSQL via remix/data-table.

## Key Points

- **Framework**: Remix 3 with fetch-router for SSR
- **Database**: PostgreSQL with remix/data-table ORM
- **Session**: Cookie-based auth with session regeneration
- **Client Assets**: esbuild-bundled TSX with `clientEntry()` hydration
- **Styling**: Typed design tokens via `createTheme()` + `var(--rmx-*)` CSS variables

## Architecture

```
app/
├── controllers/     # Route handlers (SSR)
├── assets/         # Client-bundled components
├── data/          # DB setup, schema, migrations
├── middleware/     # Auth, session, admin checks
├── ui/            # Reusable components
└── utils/         # Helpers (cart, password, etc.)
```

## Key Patterns

1. **Component Factory**: Curried functions for props injection
2. **Client Entry**: `clientEntry()` + `on()` for browser events
3. **RESTful Forms**: Method override via `_method` hidden input
4. **Inline Grids**: Click-to-edit with optimistic UI

## Reference

- Index: [navigation.md](../navigation.md)
- UI patterns: [ui-styling.md](../guides/ui-styling.md)
