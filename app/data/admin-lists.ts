import { type Database } from 'remix/data-table'

/** Results are ordered by `sortColumn`/`direction`; the column is
 *  validated against a fixed whitelist so the ORDER BY clause cannot be
 *  injected. Falls back to `created_at DESC` when omitted. */
export async function searchLists(
  db: Database,
  searchPattern: string,
  limit: number,
  offset: number,
  sortColumn?: string,
  direction?: 'asc' | 'desc',
): Promise<Record<string, unknown>[]> {
  let column =
    sortColumn === 'id'
      ? 'id'
      : sortColumn === 'title'
        ? 'title'
        : sortColumn === 'description'
          ? 'description'
          : sortColumn === 'updated_at'
            ? 'updated_at'
            : 'created_at'
  let orderDir = direction === 'asc' ? 'ASC' : 'DESC'
  let result = await db.exec(
    `SELECT * FROM lists
     WHERE title ILIKE $1
        OR description ILIKE $1
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(list) item
          WHERE item->>'label' ILIKE $1
        )
     ORDER BY ${column} ${orderDir}, id DESC
     LIMIT $2 OFFSET $3`,
    [searchPattern, limit, offset],
  )
  return ((result.rows ?? []) as Record<string, unknown>[]).map((row) => {
    let list = row.list
    if (typeof list === 'string') {
      try {
        list = JSON.parse(list as string)
      } catch {
        list = []
      }
    }
    return {
      ...row,
      list,
      created_at: typeof row.created_at === 'string' ? Number(row.created_at) : row.created_at,
      updated_at: typeof row.updated_at === 'string' ? Number(row.updated_at) : row.updated_at,
    }
  })
}
