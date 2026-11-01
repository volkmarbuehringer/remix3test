import { closeAppDatabase, initializeAppDatabase } from '../app/db.ts'

// Applies pending migrations (if any) and then runs the idempotent app seed.
// Used by `npm run db:seed`; `npm run db:reset -- --force` recreates the
// database and a normal server boot seeds it as well.
try {
  await initializeAppDatabase()
} catch (error) {
  // Preserve the migration/seed failure if closing the pool also fails.
  await closeAppDatabase().catch(() => {})
  throw error
}
await closeAppDatabase()
