import { rawSql, type Database } from 'remix/data-table'
import { compileOrderByDirection } from 'remix/data-table/sql-helpers'
import { z } from 'zod/v4'

import { int8, int8Aggregate, queryRow, queryRows } from './rows.ts'

const listWireSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  owner_email: z.string().nullable(),
  // Any JSON value: the column is user data, so shape drift (an object instead
  // of an array) degrades to an empty list instead of failing the whole grid
  // through RawRowError. Element narrowing lives in toListItems below, and the
  // tolerant behavior is pinned by the malformed-payload test.
  list: z.json(),
  title: z.string(),
  description: z.string(),
  created_at: int8,
  updated_at: int8,
})

export interface ListRow {
  id: number
  title: string
  list: Array<{ id: string; label: string; done?: boolean | undefined }>
  description: string
  created_at: number
  updated_at: number
  /** Email of the list owner, or null when the list has no owner. */
  owner_email: string | null
}

/** Narrow the JSONB `list` column (the wire schema types it as `unknown`) into
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

function wireToListRow(row: z.output<typeof listWireSchema>): ListRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    list: toListItems(row.list),
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner_email: row.owner_email,
  }
}

/** Every grid/edit row selects the list plus its owner's email through the same
 *  join, so no caller can render a row without owner information. */
const LIST_ROW_SELECT = `SELECT lists.*, u.email AS owner_email
FROM lists
LEFT JOIN users u ON u.id = lists.user_id`

/**
 * The JSONB `list` column is user data, so shape drift (an object/scalar
 * instead of an array) is tolerated at read time. Guarding here keeps a
 * malformed row from 500ing the grid through `jsonb_array_elements` /
 * `jsonb_array_length`.
 */
const LIST_ITEMS_ARRAY = `CASE WHEN jsonb_typeof(lists.list) = 'array' THEN lists.list ELSE '[]'::jsonb END`

/** Item count of a well-formed row; a malformed payload counts as empty. */
const LIST_ITEM_COUNT = `jsonb_array_length(${LIST_ITEMS_ARRAY})`

/** Whitelisted ORDER BY expressions. The key is the public `sort` param value
 *  (also validated against `LIST_SORTABLE_FIELDS` in the controller); the value
 *  is the safe SQL expression it maps to. Falls back to `created_at DESC` when
 *  omitted. `owner` sorts by the joined user's email, so unowned lists group. */
const SORT_EXPRS: Record<string, string> = {
  id: 'lists.id',
  title: 'lists.title',
  owner: 'LOWER(u.email)',
  description: 'lists.description',
  items: LIST_ITEM_COUNT,
  updated_at: 'lists.updated_at',
  created_at: 'lists.created_at',
}

/** Columns the admin grid may sort by, derived from SORT_EXPRS so the grid
 *  headers and the SQL whitelist cannot drift apart. */
export const LIST_SORTABLE_FIELDS: readonly string[] = Object.keys(SORT_EXPRS)

/** Item-count filters offered by the admin grid's filter tabs. */
const LIST_ITEM_FILTERS = ['items', 'empty'] as const
type ListItemFilter = (typeof LIST_ITEM_FILTERS)[number]

/** Narrow an arbitrary query-string/form value to the whitelisted item filter
 *  set so it can never reach the SQL builder unchecked. */
export function isListItemFilter(value: string | undefined | null): value is ListItemFilter {
  return value === 'items' || value === 'empty'
}

/**
 * Turn a raw user filter into the LIKE pattern used by both the page query and
 * its total count. Keeping the clamp/escape here means the grid and its footer
 * can never disagree about what the filter matches.
 */
export function listsSearchPattern(filter?: string | null): string {
  let value = filter ? (filter.length > 200 ? filter.slice(0, 200) : filter) : ''
  return value ? `%${value.replace(/[%_\\]/g, '\\$&')}%` : '%%'
}

/**
 * Shared WHERE clause for the grid rows and its total count. `searchPattern`
 * must already be LIKE-escaped (see {@link listsSearchPattern}); conditions are
 * composed into one parameterized clause so a text search and the item-count
 * filter can be combined.
 */
function buildListWhere(
  searchPattern: string,
  status?: string,
): { where: string; params: unknown[] } {
  let conditions: string[] = []
  let params: unknown[] = []

  if (searchPattern && searchPattern !== '%%') {
    params.push(searchPattern)
    let pattern = '$' + params.length
    conditions.push(
      `(lists.title ILIKE ${pattern}
        OR lists.description ILIKE ${pattern}
        OR u.email ILIKE ${pattern}
        OR u.name ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(${LIST_ITEMS_ARRAY}) item
          WHERE item->>'label' ILIKE ${pattern}
        ))`,
    )
  }

  if (isListItemFilter(status)) {
    conditions.push(status === 'empty' ? `${LIST_ITEM_COUNT} = 0` : `${LIST_ITEM_COUNT} > 0`)
  }

  return {
    where: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
    params,
  }
}

/**
 * Results are ordered by `sortColumn`/`direction`; the column is
 * validated against a fixed whitelist so the ORDER BY clause cannot be
 * injected. Falls back to `created_at DESC` when omitted.
 *
 * `searchPattern` matches title/description/item labels and the owner's
 * email/name and must already be LIKE-escaped (escape `%`, `_`, and `\`); the
 * controller builds it from the raw filter. Pass `''`/`'%%'` to skip the text
 * search. `status` filters by whether the JSONB `list` column has items at
 * all. Conditions are composed into one parameterized WHERE clause, so callers
 * can combine a text search with an item filter.
 *
 * Every row is joined to its owner, so the grid can show who owns each list.
 * Sorting by `owner` orders by the owner's email; unowned rows always sort
 * last, in both directions.
 */
export async function searchLists(
  db: Database,
  searchPattern: string,
  limit: number,
  offset: number,
  sortColumn?: string,
  direction?: 'asc' | 'desc',
  status?: string,
): Promise<ListRow[]> {
  let column: string = SORT_EXPRS[sortColumn ?? ''] ?? 'lists.created_at'
  let orderDir = compileOrderByDirection(direction ?? 'desc')

  let { where, params } = buildListWhere(searchPattern, status)
  params.push(limit, offset)
  let limitIndex = params.length - 1
  let offsetIndex = params.length

  let rows = await queryRows(
    db,
    rawSql(
      `${LIST_ROW_SELECT}
     ${where}
     ORDER BY ${column} ${orderDir} NULLS LAST, lists.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params,
    ),
    listWireSchema,
  )
  return rows.map(wireToListRow)
}

/**
 * Total number of lists matching the grid filter. The footer needs it to show
 * "1–10 von 42" and build numbered page links; `hasMore` alone can only answer
 * "is there one more row".
 */
export async function countLists(
  db: Database,
  searchPattern: string,
  status?: string,
): Promise<number> {
  let { where, params } = buildListWhere(searchPattern, status)
  let row = await queryRow(
    db,
    rawSql(
      `SELECT COUNT(*) AS total
       FROM lists
       LEFT JOIN users u ON u.id = lists.user_id
       ${where}`,
      params,
    ),
    z.object({ total: int8Aggregate }),
  )
  return row?.total ?? 0
}

/** Load one list row (with its owner's email) for the inline edit panel. */
export async function findListRow(db: Database, id: number): Promise<ListRow | null> {
  let rows = await queryRows(
    db,
    rawSql(
      `${LIST_ROW_SELECT}
       WHERE lists.id = $1`,
      [id],
    ),
    listWireSchema,
  )
  let row = rows[0]
  return row ? wireToListRow(row) : null
}
