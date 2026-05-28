<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Data Table MySQL

**Purpose**: MySQL adapter for `remix/data-table`. Provides full data-table API backed by mysql2.

**Key Points**:
- Native `mysql2/promise` integration
- Full data-table API: queries, relations, writes, transactions
- MySQL capabilities: returning=false, savepoints=true, upsert=true
- Adapter-owned SQL compilation
- Migration DDL support

**Minimal Example**:
```ts
import { createPool } from 'mysql2/promise'
import { createDatabase } from 'remix/data-table'
import { createMysqlDatabaseAdapter } from 'remix/data-table-mysql'

let pool = createPool(process.env.DATABASE_URL)
let db = createDatabase(createMysqlDatabaseAdapter(pool))
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/data-table-mysql