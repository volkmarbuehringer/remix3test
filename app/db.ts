import * as path from 'node:path'

import { loadMigrations } from 'remix/data-table/migrations/node'
import { createPostgresDatabase } from 'remix/data-table/postgres'

import { seed } from './data/seed.ts'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Set it in .env')
}

const localeUrl =
  databaseUrl + (databaseUrl.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'

export const db = createPostgresDatabase({
  connectionString: localeUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
})

export function loadAppMigrations() {
  return loadMigrations(path.join(import.meta.dirname, '../db/migrations'))
}

export function loadAppSeed() {
  return seed
}

export async function initializeAppDatabase(): Promise<void> {
  await db.migrate(await loadAppMigrations())
  await seed(db)
}

export async function closeAppDatabase(): Promise<void> {
  await db.close()
}
