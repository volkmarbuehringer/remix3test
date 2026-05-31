<!-- Context: development/remix3/guides/demo-patterns | Priority: medium | Version: 1.0 | Updated: 2026-03-24 -->

# Demo Patterns

How to create and structure demos in this repository.

## Core Concept
Demos are durable reference artifacts, not throwaway prototypes. They teach Remix patterns through realistic edge cases and production-quality code.

## Key Points
- Use Remix packages for framework behavior, not third-party routers
- Demo servers use port **44100**
- Handle `SIGINT`/`SIGTERM` cleanly
- Demos teach good patterns - assume readers will study code

## Demo Structure
```
demos/<name>/
├── package.json, tsconfig.json, server.ts, README.md
├── app/ (router.tsx, routes.ts, controllers/, ui/, data/, middleware/)
├── db/, public/, test/
```

## Controller Layout
```
controllers/ → render.tsx, home/controller.tsx, auth/controller.tsx + signup/, ui/auth-card.tsx + document.tsx
```

## Demo Rules
- Import from `remix` package exports, not `@remix-run/*`
- Use idiomatic Remix patterns with `remix/ui`
- Keep non-Remix dependencies incidental to runtime only
- Push Remix through realistic edge cases, not toy examples
- Co-locate tests with implementation modules

## README Content
- Explain what the demo proves/teaches
- Document how to run locally
- Point out key Remix APIs being demonstrated

## Validation
```bash
pnpm -C demos/<name> typecheck && pnpm -C demos/<name> test && pnpm run lint
```

## 📂 Codebase References
- `demos/sse/` - SSE demo reference
- `demos/bookstore/` - Full e-commerce demo (auth, cart, admin)
- `.agents/skills/make-demo/SKILL.md` - Full skill guide

## Bookstore Demo Patterns
Full e-commerce demo with auth, cart, checkout, and admin.

### Route Structure
`/` → Home, `/books` → Catalog, `/books/:slug` → Details, `/cart` → Cart, `/checkout` → Checkout, `/account` → Dashboard, `/account/orders` → History, `/admin` → Dashboard, `/admin/books` → Book CRUD, `/admin/users` → User management, `/admin/orders` → Order management, `/auth/login` → Login, `/auth/register` → Registration

### Controller Pattern
```typescript
export default {
  actions: {
    async index({ get, url }) { let db = get(Database); return render(<Page {...data} />) },
    async show({ get, params }) { /* ... */ },
    async create({ get }) { /* ... */ },
    async update({ get, params, url }) { /* ... */ },
    async destroy({ get, params, request }) { /* ... */ },
  },
} satisfies Controller<typeof routes.resource>
```

### Type-Safe Sorting
```typescript
const BOOK_SORT_COLUMNS = ['id', 'title', 'author', 'genre', 'price'] as const
export function parseSort(url: URL, validColumns: readonly string[]): SortState {
  let column = url.searchParams.get('sort') ?? 'id'
  let direction = (url.searchParams.get('dir') ?? 'desc') as 'asc' | 'desc'
  if (!validColumns.includes(column)) column = 'id'
  return { column, direction }
}
```

### Key Patterns
- Factory pattern for components (`export function Component() { return ({ props }) => ... }`) — **Deprecated** in favor of `Handle<Props>` pattern (see `remix-ui-skill.md`)
- Type-safe URL param parsing, preserved pagination params in edit/update flows
- Session-based auth with httpOnly cookies, PostgreSQL with pg

## Related
- `guides/monorepo-packages.md` - Package conventions
- `guides/pr-workflow.md` - PR workflow
