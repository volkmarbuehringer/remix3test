export { db, closeAppDatabase } from './connection.ts'
import { db, getMigrations, migrateAppDatabase } from './connection.ts'
import { seed } from './seed.ts'

export async function initializeAppDatabase(): Promise<void> {
  await migrateAppDatabase(await getMigrations())
  await seed(db)
}

export async function resetTestDatabase(): Promise<void> {
  await db.wipe()
  await migrateAppDatabase(await getMigrations())
  await seed(db)
}
