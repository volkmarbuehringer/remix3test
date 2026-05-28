---
title: PostgreSQL Data Table Setup
category: guides
type: context
source: /home/lucky/remix/packages/data-table-postgres/src/index.ts
tags: [remix3, guides, setup, data-table, postgres]
---

# PostgreSQL Data Table Setup

## Core Concept
Step-by-step guide to configure Remix's data-table package with PostgreSQL backend. Covers connection pooling and JSON column support.

## Steps

### 1. Install Package
```bash
npm i remix pg
```

### 2. Configure Connection Pool
```ts
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'
import pg from 'pg'

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'my_app',
  max: 20, // connection pool size
  idleTimeoutMillis: 30000,
})

export const dataTable = createPostgresDatabaseAdapter({ pool })
```

### 3. Run Migration
```bash
remix data-table migrate --adapter postgres
```

### 4. Query with JSON Support
```ts
// Supports PostgreSQL JSON columns
const books = await dataTable.query('books')
  .select('id', 'title', 'metadata') // metadata is JSON column
  .execute()
```

## Reference
- [node-postgres Package](https://github.com/brianc/node-postgres)
