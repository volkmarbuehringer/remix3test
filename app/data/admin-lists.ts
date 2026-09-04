import { rawSql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { queryRows } from './rows.ts'

const listWireSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  list: z.array(z.object({ id: z.string(), label: z.string(), done: z.boolean().optional() })),
  title: z.string(),
  description: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export interface AdminListRow {
  id: number
  title: string
  list: Array<{ id: string; label: string; done?: boolean | undefined }>
  description: string
  created_at: number
  updated_at: number
}

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
): Promise<AdminListRow[]> {
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
  let rows = await queryRows(
    db,
    rawSql(
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
    ),
    listWireSchema,
  )
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    list: row.list,
    description: row.description,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  }))
}
