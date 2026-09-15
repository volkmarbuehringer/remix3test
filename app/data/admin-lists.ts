import { rawSql, type Database, type TableRow } from 'remix/data-table'
import { compileOrderByDirection } from 'remix/data-table/sql-helpers'
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

/** Item-count filters offered by the admin grid's filter tabs. */
export const LIST_ITEM_FILTERS = ['items', 'empty'] as const
export type ListItemFilter = (typeof LIST_ITEM_FILTERS)[number]

/** Narrow an arbitrary query-string/form value to the whitelisted item filter
 *  set so it can never reach the SQL builder unchecked. */
export function isListItemFilter(value: string | undefined | null): value is ListItemFilter {
  return value === 'items' || value === 'empty'
}

/** Results are ordered by `sortColumn`/`direction`; the column is
 *  validated against a fixed whitelist so the ORDER BY clause cannot be
 *  injected. Falls back to `created_at DESC` when omitted.
 *
 *  `searchPattern` matches title/description/item labels; pass `''`/`'%%'`
 *  to skip the text search. `status` filters by whether the JSONB `list`
 *  column has items at all. Conditions are composed into one parameterized
 *  WHERE clause, so callers can combine a text search with an item filter. */
export async function searchLists(
  db: Database,
  searchPattern: string,
  limit: number,
  offset: number,
  sortColumn?: string,
  direction?: 'asc' | 'desc',
  status?: string,
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
  let orderDir = compileOrderByDirection(direction ?? 'desc')

  let conditions: string[] = []
  let params: unknown[] = []

  if (searchPattern && searchPattern !== '%%') {
    params.push(searchPattern)
    let pattern = '$' + params.length
    conditions.push(
      `(title ILIKE ${pattern}
        OR description ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(list, '[]'::jsonb)) item
          WHERE item->>'label' ILIKE ${pattern}
        ))`,
    )
  }

  // `list` is nullable in the schema; COALESCE keeps the length check safe.
  if (isListItemFilter(status)) {
    conditions.push(
      status === 'empty'
        ? `jsonb_array_length(COALESCE(list, '[]'::jsonb)) = 0`
        : `jsonb_array_length(COALESCE(list, '[]'::jsonb)) > 0`,
    )
  }

  let where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  params.push(limit, offset)
  let limitIndex = params.length - 1
  let offsetIndex = params.length

  let rows = await queryRows(
    db,
    rawSql(
      `SELECT * FROM lists
     ${where}
     ORDER BY ${column} ${orderDir}, id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params,
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
