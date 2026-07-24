import { Pool } from 'pg'
import { PostgresStoreVNext } from '@mastra/pg'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')
const localeUrl =
  url + (url.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'

const pool = new Pool({
  connectionString: localeUrl,
  max: 5,
})

// Shared storage instance used by both Mastra and Memory.
export const mastraStorage = new PostgresStoreVNext({
  id: 'mastra',
  pool,
  observability: { pool },
})

{
  let obs = mastraStorage.stores?.observability
  if (obs && obs.constructor?.name?.startsWith('_ObservabilityStorage')) {
    Object.defineProperty(obs.constructor, 'name', {
      value: 'ObservabilityStoragePostgresVNext',
    })
  }
}
