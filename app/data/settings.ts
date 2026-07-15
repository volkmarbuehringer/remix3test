import { type Database } from 'remix/data-table'

export async function deleteUser(db: Database, userId: number): Promise<boolean> {
  return await db.transaction(async (tx) => {
    await tx.exec('DELETE FROM api_tokens WHERE user_id = $1', [userId])
    let result = await tx.exec('DELETE FROM users WHERE id = $1', [userId])
    return (result.affectedRows ?? 0) > 0
  })
}
