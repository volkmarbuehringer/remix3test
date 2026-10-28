import { rawSql, type Database } from 'remix/data-table'
import { compileOrderByDirection } from 'remix/data-table/sql-helpers'
import { z } from 'zod/v4'

import { int8, int8Aggregate, queryRow, queryRows } from './rows.ts'

export interface AdminMessageRow {
  id: number
  /** Null when the sender account was deleted (FK is ON DELETE SET NULL). */
  sender_id: number | null
  /** Null when the sender account was deleted; the grid renders a fallback. */
  sender_name: string | null
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
  sender_id: z.number().nullable(),
  sender_name: z.string().nullable(),
  content: z.string(),
  created_at: int8,
})

/**
 * Escape LIKE wildcards so a search is treated as a literal substring, then
 * wrap it for a `%…%` match. Shared by the list and count queries so the grid
 * and its result total can never disagree about what the filter matches.
 */
function likePattern(filter: string | undefined): string | undefined {
  return filter ? `%${filter.replace(/[%_\\]/g, '\\$&')}%` : undefined
}

const messagesFilterWhere = (placeholder: string): string =>
  `WHERE (m.content ILIKE ${placeholder} OR u.name ILIKE ${placeholder})`

export async function listMessages(
  db: Database,
  limit: number,
  offset: number,
  filter?: string,
  sortColumn?: string,
  direction?: 'asc' | 'desc',
): Promise<AdminMessageRow[]> {
  let orderCol = SORT_EXPRS[sortColumn ?? 'created_at'] ?? SORT_EXPRS.created_at
  let orderDir = compileOrderByDirection(direction ?? 'desc')
  let pattern = likePattern(filter)
  let where = ''
  let params: unknown[] = [limit, offset]
  if (pattern) {
    params.push(pattern)
    where = messagesFilterWhere('$3')
  }
  let rows = await queryRows(
    db,
    rawSql(
      `SELECT m.id, m.sender_id, u.name AS sender_name, m.content, m.created_at
     FROM messages m
     LEFT JOIN users u ON m.sender_id = u.id
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

/**
 * Total number of messages matching the grid filter. The grid footer needs it
 * to show "1–10 von 42" and to build numbered page links; `hasMore` alone can
 * only answer "is there one more row".
 *
 * Uses the same LEFT JOIN as {@link listMessages}: a message whose sender was
 * deleted must keep counting as a row even though its sender_name is null.
 */
export async function countMessages(db: Database, filter?: string): Promise<number> {
  let pattern = likePattern(filter)
  let row = await queryRow(
    db,
    rawSql(
      `SELECT COUNT(*) AS total
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       ${pattern ? messagesFilterWhere('$1') : ''}`,
      pattern ? [pattern] : [],
    ),
    z.object({ total: int8Aggregate }),
  )
  return row?.total ?? 0
}
