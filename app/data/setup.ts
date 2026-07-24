export { db, closeAppDatabase, getMigrations } from './connection.ts'
import { db, getMigrations } from './connection.ts'
import { seed } from './seed.ts'

export async function initializeAppDatabase(): Promise<void> {
  await db.migrate(await getMigrations())
  await seed(db)
}

export async function resetTestDatabase(): Promise<void> {
  await db.reset({
    migrations: await getMigrations(),
    seed,
  })
}
