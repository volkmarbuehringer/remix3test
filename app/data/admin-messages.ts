import { rawSql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { queryRows } from './rows.ts'

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

const adminMessageWireSchema = z.object({
  id: z.number(),
  sender_id: z.number(),
  sender_name: z.string(),
  content: z.string(),
  created_at: z.string(),
})

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
  let rows = await queryRows(
    db,
    rawSql(
      `SELECT m.id, m.sender_id, u.name AS sender_name, m.content, m.created_at
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     ${where}
     ORDER BY ${orderCol} ${orderDir}, m.id DESC
     LIMIT $1
     OFFSET $2`,
      params,
    ),
    adminMessageWireSchema,
  )
  return rows.map((row) => ({
    id: row.id,
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    content: row.content,
    created_at: Number(row.created_at),
  }))
}
