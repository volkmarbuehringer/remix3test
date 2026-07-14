import { PostgresStoreVNext } from '@mastra/pg'
import { pool } from '../../data/connection.ts'

// Shared storage instance used by both Mastra and Memory.
// PostgresStoreVNext composes PostgresStore with the v-next observability
// domain that supports log listing. The observability connection reuses
// the same pool (safe for local dev — switch to a dedicated connection
// in production if throughput exceeds ~1,500 spans/sec).
export const mastraStorage = new PostgresStoreVNext({
  id: 'mastra',
  pool,
  observability: { pool },
})

// The bundled class uses internal name _ObservabilityStoragePostgresVNext but
// the Studio frontend checks for the public name. Fix the constructor name
// so metrics detection passes.
{
  let obs = mastraStorage.stores?.observability
  if (obs && obs.constructor?.name?.startsWith('_ObservabilityStorage')) {
    Object.defineProperty(obs.constructor, 'name', {
      value: 'ObservabilityStoragePostgresVNext',
    })
  }
}
