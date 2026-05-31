---
title: MySQL Data Table Setup
category: guides
type: context
source: /home/lucky/remix/packages/data-table-mysql/src/index.ts
tags: [remix3, guides, setup, data-table, mysql]
---

# MySQL Data Table Setup

## Core Concept
Step-by-step guide to configure Remix's data-table package with MySQL backend. Covers connection setup, schema migration, and query integration.

## Steps

### 1. Install Package
```bash
npm i remix mysql2
```

### 2. Configure Connection
```ts
import { createMysqlDatabaseAdapter } from 'remix/data-table-mysql'
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'my_app',
  waitForConnections: true,
  connectionLimit: 10,
})

export const dataTable = createMysqlDatabaseAdapter({ pool })
```

### 3. Run Migration
```bash
remix data-table migrate --adapter mysql
```

### 4. Integrate with Route
```ts
import { dataTable } from './data-table'

export function loader() {
  return dataTable.query('books').select('*').execute()
}
```

## Reference
- [MySQL2 Package](https://github.com/sidorares/node-mysql2)
