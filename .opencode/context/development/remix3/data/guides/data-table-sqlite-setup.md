---
title: SQLite Data Table Setup
category: guides
type: context
source: /home/lucky/remix/packages/data-table-sqlite/src/index.ts
tags: [remix3, guides, setup, data-table, sqlite]
---

# SQLite Data Table Setup

## Core Concept
Step-by-step guide to configure Remix's data-table package with SQLite backend. Covers file-based and in-memory database options.

## Steps

### 1. Install Package
```bash
npm i remix better-sqlite3
```

### 2. Configure Database
```ts
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'
import Database from 'better-sqlite3'

// File-based database
const db = new Database('./data.db')

// Or in-memory database (for testing)
// const db = new Database(':memory:')

export const dataTable = createSqliteDatabaseAdapter({ db })
```

### 3. Enable WAL Mode (Optional)
```ts
// Improves concurrency for file-based databases
db.pragma('journal_mode = WAL')
```

### 4. Run Migration
```bash
remix data-table migrate --adapter sqlite
```

### 5. Use in Route
```ts
export function loader() {
  return dataTable.query('books').select('*').limit(10).execute()
}
```

## Reference
- [Better SQLite3 Package](https://github.com/WiseLibs/better-sqlite3)
