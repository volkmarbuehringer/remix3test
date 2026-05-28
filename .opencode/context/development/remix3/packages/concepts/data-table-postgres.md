<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Data Table PostgreSQL

**Purpose**: PostgreSQL adapter for `remix/data-table`. Provides full data-table API backed by pg.

**Key Points**:
- Native `pg` Pool integration
- Full data-table API: queries, relations, writes, transactions
- Postgres capabilities: returning=true, savepoints=true, upsert=true
- Adapter-owned SQL compilation
- Transaction options: isolationLevel, readOnly

**Minimal Example**:
```ts
import { Pool } from 'pg'
import { createDatabase } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

let pool = new Pool({ connectionString: process.env.DATABASE_URL })
let db = createDatabase(createPostgresDatabaseAdapter(pool))
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/data-table-postgres