<!-- Context: development/remix3/guides/postgresql-database | Priority: high | Version: 1.0 | Updated: 2026-04-12 -->

# PostgreSQL Database Setup

How to add PostgreSQL persistence to a Remix app following the remix-application-layout skill.

## Core Concept

Database setup lives in `app/data/setup.ts`, request injection in `app/middleware/database.ts`, artifacts in `db/`. Route handlers read `Database` from request context.

## Directory Structure

```
<app>/
├── app/
│   ├── data/
│   │   └── setup.ts      # Database adapter + setup
│   ├── middleware/
│   │   └── database.ts # Request context injection
│   └── controllers/
│       └── home.tsx
├── db/
│   └── migrations/      # SQL migration files
└── .env
```

## Workflow

1. Install dependency:

```sh
npm i pg remix/data-table-postgres
```

2. Create `app/data/setup.ts`:

```ts
import Pool from 'pg'
import { createDatabase, type Database } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/myapp',
})

export const db: Database = createDatabase(createPostgresDatabaseAdapter(pool))
```

3. Create `app/middleware/database.ts`:

```ts
import type { Middleware } from 'remix/fetch-router'
import { Database } from 'remix/data-table'
import { db } from '../data/setup.ts'

type SetDatabaseContextTransform = readonly [readonly [typeof Database, Database]]

export function loadDatabase(): Middleware<'ANY', {}, SetDatabaseContextTransform> {
  return async (context, next) => {
    context.set(Database, db)
    return next()
  }
}
```

4. Register in `app/router.ts`:

```ts
import { loadDatabase } from './middleware/database.ts'

let middleware = [loadDatabase()] as const
export let router = createRouter({ middleware })
```

5. Use in route handlers:

```ts
import { Database, sql } from 'remix/data-table'

export let home: BuildAction<'GET', typeof routes.home> = {
  async handler({ get }) {
    let db = get(Database)
    await db.exec(sql`select 1`)
    return render(<HomePage />)
  },
}
```

6. Set environment variable:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myapp
```

## Key Rules

- `db/migrations/` for SQL migration files
- `app/data/setup.ts` owns adapter
- `app/middleware/database.ts` injects into context
- Handlers read from context, not direct import
- Use connection pooling for production

## Checklist

- [ ] `DATABASE_URL` set in environment
- [ ] `app/data/setup.ts` owns PostgreSQL setup
- [ ] `app/middleware/database.ts` injects `Database`
- [ ] `app/router.ts` registers middleware
- [ ] Handlers use `get(Database)` from context

## 📂 Codebase References

- `bookstore/app/data/setup.ts` - Full PostgreSQL setup with migrations
- `demos/sse/` - SSE demo (uses SQLite for development)

## Related

- `guides/app-layout.md` - App directory structure
- `guides/database-initialization.md` - PostgreSQL + SQLite patterns