import { Pool } from 'pg'
import { createDatabase } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table/postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Set it in .env')
}

const localeUrl =
  databaseUrl + (databaseUrl.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'

export const pool = new Pool({
  connectionString: localeUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
})

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err)
})

const adapter = createPostgresDatabaseAdapter(pool)

export const db = createDatabase(adapter)

let appClosed = false
export async function closeAppDatabase(): Promise<void> {
  if (appClosed) return
  appClosed = true
  await pool.end().catch((err) => console.error('Error closing database pool:', err))
}
