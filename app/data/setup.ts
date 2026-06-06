export { pool, db, closeAppDatabase } from './connection.ts'
import { migrate } from './migrate.ts'
import { seed } from './seed.ts'

let initializePromise: Promise<void> | null = null

export async function initializeAppDatabase(): Promise<void> {
  if (!initializePromise) {
    initializePromise = (async () => {
      await migrate()
      await seed()
    })()
  }

  await initializePromise
}
