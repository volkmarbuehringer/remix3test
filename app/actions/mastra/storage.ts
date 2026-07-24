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

// Observability data should go to a dedicated Postgres instance in production.
// Default: separate connection to same host so it doesn't contend with the primary pool.
const obsUrl =
  process.env.OBSERVABILITY_DATABASE_URL ||
  process.env.DATABASE_URL
if (!obsUrl) throw new Error('OBSERVABILITY_DATABASE_URL or DATABASE_URL is required for observability')
const localeObsUrl =
  obsUrl + (obsUrl.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'

const obsPool = new Pool({
  connectionString: localeObsUrl,
  max: 3,
})

// Shared storage instance used by both Mastra and Memory.
export const mastraStorage = new PostgresStoreVNext({
  id: 'mastra',
  pool,
  observability: { pool: obsPool },
})

{
  let obs = mastraStorage.stores?.observability
  if (obs && obs.constructor?.name?.startsWith('_ObservabilityStorage')) {
    Object.defineProperty(obs.constructor, 'name', {
      value: 'ObservabilityStoragePostgresVNext',
    })
  }
}
