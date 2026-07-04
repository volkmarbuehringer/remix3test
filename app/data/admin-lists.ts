import { type Database } from 'remix/data-table'

export async function searchLists(
  db: Database,
  searchPattern: string,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  let result = await db.exec(
    `SELECT * FROM lists
     WHERE description ILIKE $1
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(list) item
          WHERE item->>'label' ILIKE $1
        )
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [searchPattern, limit, offset],
  )
  return ((result.rows ?? []) as Record<string, unknown>[]).map((row) => {
    let list = row.list
    if (typeof list === 'string') {
      try { list = JSON.parse(list as string) } catch { list = [] }
    }
    return {
      ...row,
      list,
      created_at: typeof row.created_at === 'string' ? Number(row.created_at) : row.created_at,
      updated_at: typeof row.updated_at === 'string' ? Number(row.updated_at) : row.updated_at,
    }
  })
}
