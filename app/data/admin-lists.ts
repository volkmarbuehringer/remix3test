import { rawSql, type Database, type TableRow } from 'remix/data-table'
import { z } from 'zod/v4'

import type { lists } from './schema.ts'
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

export interface ListRow {
  id: number
  title: string
  list: Array<{ id: string; label: string; done?: boolean | undefined }>
  description: string
  created_at: number
  updated_at: number
}

/** Narrow the JSONB `list` column (typed `unknown` in a raw `TableRow`) into
 *  the display row's item shape, guarding each element. */
function toListItems(value: unknown): ListRow['list'] {
  if (!Array.isArray(value)) return []
  let items: ListRow['list'] = []
  for (let raw of value) {
    if (raw && typeof raw === 'object') {
      let item = raw as { id?: unknown; label?: unknown; done?: unknown }
      items.push({
        id: typeof item.id === 'string' ? item.id : '',
        label: typeof item.label === 'string' ? item.label : '',
        ...(typeof item.done === 'boolean' ? { done: item.done } : {}),
      })
    }
  }
  return items
}

/** Adapt a raw `lists` table row — whose json/bigint columns surface as
 *  `unknown` — into the typed display row. This is the single boundary where
 *  the vendor column types are narrowed, so callers never need
 *  `as unknown as ListRow`. */
export function toListRow(row: TableRow<typeof lists>): ListRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    list: toListItems(row.list),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
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
): Promise<ListRow[]> {
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
