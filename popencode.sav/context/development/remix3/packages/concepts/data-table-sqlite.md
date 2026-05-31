<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Data Table SQLite

**Purpose**: SQLite adapter for `remix/data-table`. Provides full data-table API backed by better-sqlite3.

**Key Points**:
- Native `better-sqlite3` integration
- Full data-table API: queries, relations, writes, transactions
- SQLite capabilities: returning=true, savepoints=true, upsert=true
- In-memory database support for testing
- Good fit for local dev and embedded deployments

**Minimal Example**:
```ts
import Database from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let sqlite = new Database('app.db')
let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite