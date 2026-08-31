import { type Database } from 'remix/data-table'

export interface AdminMessageRow {
  id: number
  sender_id: number
  sender_name: string
  content: string
  created_at: number
}

/** Whitelisted ORDER BY expressions. The key is the public `sort` param value
 *  (also validated against SORTABLE_FIELDS in the controller); the value is the
 *  safe SQL expression it maps to. Falls back to `created_at DESC` when omitted. */
const SORT_EXPRS: Record<string, string> = {
  id: 'm.id',
  sender_name: 'u.name',
  content: 'm.content',
  created_at: 'm.created_at',
}

export async function listMessages(
  db: Database,
  limit: number,
  offset: number,
  filter?: string,
  sortColumn?: string,
  direction?: 'asc' | 'desc',
): Promise<AdminMessageRow[]> {
  let orderCol = SORT_EXPRS[sortColumn ?? 'created_at'] ?? SORT_EXPRS.created_at
  let orderDir = direction === 'asc' ? 'ASC' : 'DESC'
  let where = ''
  let params: unknown[] = [limit, offset]
  if (filter) {
    // Escape LIKE wildcards so the filter is treated as a literal substring.
    let esc = filter.replace(/[%_\\]/g, '\\$&')
    params.push(`%${esc}%`)
    where = 'WHERE m.content ILIKE $3 OR u.name ILIKE $3'
  }
  let result = await db.exec(
    `SELECT m.id, m.sender_id, u.name AS sender_name, m.content, m.created_at
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     ${where}
     ORDER BY ${orderCol} ${orderDir}, m.id DESC
     LIMIT $1
     OFFSET $2`,
    params,
  )
  return ((result.rows ?? []) as Record<string, unknown>[]).map((row) => ({
    id: typeof row.id === 'string' ? Number(row.id) : (row.id as number),
    sender_id:
      typeof row.sender_id === 'string' ? Number(row.sender_id) : (row.sender_id as number),
    sender_name: row.sender_name as string,
    content: row.content as string,
    created_at:
      typeof row.created_at === 'string' ? Number(row.created_at) : (row.created_at as number),
  }))
}
