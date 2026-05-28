<!-- Context: project-intelligence/bookstore/lookup | Priority: medium | Version: 3.0 | Updated: 2026-05-16 -->

# Quick Reference

## Test Commands

```bash
pnpm test                    # Unit/integration tests (~62)
pnpm run typecheck           # TypeScript (tsgo --noEmit)
pnpm run lint                # Lint
pnpm run lint:fix            # Lint + auto-fix
pnpm run format              # Prettier
```

## Seed Data

| Account | Password | Role |
|---------|----------|------|
| admin@bookstore.com | admin123 | Admin dashboard |
| customer@example.com | password123 | Customer tests |

Books: 100 total

## Database

| Item | Value |
|------|-------|
| Connection | `postgresql://postgres:postgres@localhost:5432/bookstorenew` |
| ORM | `remix/data-table` + `remix/data-table-postgres` |
| Tables | 5 (books, users, orders, order_items, password_reset_tokens) |

## Theme Token Mapping

Hardcoded values replaced with `var(--rmx-*)` tokens in `app/assets/app.css`:

| Old Value | Token | Element |
|-----------|-------|---------|
| `#333333` | `var(--rmx-color-text-primary)` | Body text |
| `#f5f5f5` | `var(--rmx-surface-lvl0)` | Page background |
| `#ffffff` | `var(--rmx-surface-lvl1)` | Card, table backgrounds |
| `#f8f9fa` | `var(--rmx-surface-lvl2)` | Table header bg |
| `#ecf0f1` | `var(--rmx-surface-lvl3)` | Book card img placeholder |
| `#e0e0e0` | `var(--rmx-surface-lvl4)` | Subtle dividers |
| `#3498db` | `var(--rmx-color-action-primary-background)` | Primary buttons |
| `#2980b9` | `var(--rmx-color-action-primary-background-hover)` | Primary btn hover |
| `#95a5a6` | `var(--rmx-color-action-secondary-background)` | Secondary buttons |
| `#7f8c8d` | `var(--rmx-color-action-secondary-background-hover)` | Secondary btn hover |
| `#e74c3c` | `var(--rmx-color-action-danger-background)` | Danger buttons |
| `#c0392b` | `var(--rmx-color-action-danger-background-hover)` | Danger btn hover |
| `#dddddd` | `var(--rmx-color-border-default)` | Form borders, table lines |
| `#7f8c8d` | `var(--rmx-color-text-muted)` | Author text, meta |

Hardcoded values replaced with `theme.*` tokens in action `css()` mixins:

| Old Value | Token | File(s) |
|-----------|-------|---------|
| `#666666` | `theme.colors.text.secondary` | `cart-items.tsx`, `admin/books/form.tsx` |
| `#f5f5f5` | `theme.surface.lvl0` | `image-carousel.tsx` |
| `#f8f9fa` | `theme.surface.lvl2` | `show-page.tsx`, `login/page.tsx`, `forgot-password/page.tsx` |

Values that **remain hardcoded** (brand-specific):

| Value | Use |
|-------|-----|
| `#2c3e50` | Header background |
| `#34495e` | Footer background |
| `#27ae60` | Book price |
| `#d4edda` / `#c3e6cb` / `#155724` | Alert success |
| `#f8d7da` / `#f5c6cb` / `#721c24` | Alert error |
| `#fff3cd` / `#856404` | Badge warning |
| `#d1ecf1` / `#0c5460` | Badge info |

## File Locations

| Purpose | Path |
|---------|------|
| Routes | `app/routes.ts` |
| Controllers | `app/actions/` |
| DB Setup | `app/data/setup.ts` |
| DB Schema | `app/data/schema.ts` |
| Middleware | `app/middleware/` |
| UI | `app/ui/` |
| Client Assets | `app/assets/` |

## Related

- `lookup/postgresql-database-reference.md` — Detailed DB reference
- `guides/postgresql-migration-patterns.md` — Migration steps
- `guides/database-config.md` — Database configuration
