process.loadEnvFile('./.env')
import { Pool } from 'pg'
import { createDatabase } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table/postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Set it in .env')
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,
})

const adapter = createPostgresDatabaseAdapter(pool)

export const db = createDatabase(adapter)

export function closeAppDatabase(): void {
  pool.end().catch((err) => console.error('Error closing database pool:', err))
}
