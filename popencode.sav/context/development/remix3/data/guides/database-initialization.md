# Guide: Database Initialization

**Core Idea**: Initialize PostgreSQL with migrations using `remix/data-table`.

## Quick Setup

```typescript
// app/data/setup.ts
import { Pool } from 'pg'
import { createDatabase } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = createPostgresDatabaseAdapter(pool)
export const db = createDatabase(adapter)

// Initialize
export async function initializeDatabase() {
  const runner = createMigrationRunner(db, loadMigrations('./db/migrations'))
  await runner.migrateUp()
}
```

## Key Points

- Use `remix/data-table-postgres` adapter for PostgreSQL
- Load migrations from `./db/migrations` directory
- Run `initializeDatabase()` at app startup
- Reference: `.opencode/context/development/remix3/guides/database-initialization.md`