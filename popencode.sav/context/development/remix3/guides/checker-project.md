<!-- Context: development/remix3/guides | Priority: high | Version: 1.2 | Updated: 2026-04-20 -->

# Concept: Checker Project

**Core Idea**: Checker is a Remix 3 SSR app with flat/hierarchical controllers, PostgreSQL database, and custom oxlint plugins. Uses pure server-side rendering without clientEntry for admin routes.

**Key Points**:
- Entry: `server.ts`, Router: `app/router.ts`, Routes: `app/routes.ts`
- Controllers: `app/controllers/**` - flat (home.tsx) or hierarchical (auth/login/page.tsx)
- UI: `app/ui/**` shared components, Database: `app/data/setup.ts` with pg driver
- Lint: oxlint + prettier + TypeScript strict mode
- Admin uses backUrl pattern to preserve sort/filter/pagination state

**Quick Example**:
```typescript
// Router setup
import { createRouter } from 'remix/fetch-router'
export const router = createRouter()
router.map(routes.home, home)

// Route definition
export const routes = { books: { index: get('/books'), edit: get('/books/:id/edit') } }
```

**Import Convention**: Use `/remix/*` imports:
- `remix/fetch-router` - Router
- `remix/ui` - JSX rendering
- `remix/node-fetch-server` - Request handling

**Database Schema**:
```sql
CREATE TABLE users (id SERIAL, email TEXT, password_hash TEXT, role TEXT, pagesize INTEGER)
CREATE TABLE books (id SERIAL, title TEXT, author TEXT, price DECIMAL, genre TEXT, in_stock BOOLEAN)
```

**Admin backUrl Pattern**:
```typescript
// URL: /books/123/edit?back=/books?page=2&sort=title
// Controller: formData.get('back') → 303 redirect after POST
```

**Reference**: `checker/app/controllers/admin/books/`, `checker/app/data/schema.ts`

**Related**: `guides/pagination.md`, `guides/sorting.md`, `guides/filtering.md`