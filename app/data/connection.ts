import { createDatabase } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table/postgres'
import { loadMigrations } from 'remix/data-table/migrations/node'
import * as path from 'node:path'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Set it in .env')
}

const localeUrl =
  databaseUrl + (databaseUrl.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'

const adapter = createPostgresDatabaseAdapter({
  connectionString: localeUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
})

export const db = createDatabase(adapter)

export const getMigrations = () =>
  loadMigrations(path.join(import.meta.dirname, '../../db/migrations'))

let appClosed = false
export async function closeAppDatabase(): Promise<void> {
  if (appClosed) return
  appClosed = true
}
