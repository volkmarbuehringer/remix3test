import { type Database } from 'remix/data-table'

export async function deleteUser(db: Database, userId: number): Promise<boolean> {
  let result = await db.exec('DELETE FROM users WHERE id = $1', [userId])
  return (result.affectedRows ?? 0) > 0
}
