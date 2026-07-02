import { lists } from '../data/schema.ts'
import type { Pool } from 'pg'

export interface ListRow {
  id: number
  user_id: number | null
  list: Array<{ id: string; label: string }>
  description: string
  created_at: number
  updated_at: number
}

export interface ListResult<T> {
  data: T
  hasMore: boolean
  offset: number
}

function parseRow(row: Record<string, unknown>): ListRow {
  let list = row.list
  if (typeof list === 'string') {
    try { list = JSON.parse(list) } catch { list = [] }
  }
  return {
    id: Number(row.id),
    user_id: row.user_id != null ? Number(row.user_id) : null,
    list: list as Array<{ id: string; label: string }>,
    description: String(row.description ?? ''),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  }
}

export async function getAllLists(
  db: { findMany: Function },
  pool: Pool,
  options: { offset?: number; limit?: number; filter?: string },
  userId?: number,
): Promise<ListResult<ListRow[]>> {
  let offset = Math.max(0, options.offset ?? 0)
  let limit = Math.max(1, Math.min(options.limit ?? 20, 100))
  let rawFilter = options.filter

  let rows: ListRow[]
  let hasMore: boolean

  if (rawFilter) {
    let filter = rawFilter.length > 200 ? rawFilter.slice(0, 200) : rawFilter
    let searchPattern = `%${filter}%`
    let args: unknown[] = [searchPattern, limit + 1, offset]
    let ownerClause = ''
    if (userId != null) {
      args.push(userId)
      ownerClause = 'AND user_id = $4'
    }
    let result = await pool.query(
      `SELECT * FROM lists
       WHERE (description ILIKE $1
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(list) item
            WHERE item->>'label' ILIKE $1
          )) ${ownerClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      args,
    )
    rows = result.rows.map(parseRow)
    hasMore = rows.length > limit
    if (hasMore) rows.pop()
  } else {
    let raw = await db.findMany(lists, {
      limit: limit + 1,
      offset,
      orderBy: [['created_at', 'desc']] as const,
      ...(userId != null ? { where: { user_id: userId } } : {}),
    })
    rows = raw.map((r: Record<string, unknown>) => parseRow(r))
    hasMore = rows.length > limit
    if (hasMore) rows.pop()
  }

  return { data: rows, hasMore, offset }
}

export async function getListById(
  db: { findOne: Function },
  id: number,
  userId?: number,
): Promise<ListRow | null> {
  let row = await db.findOne(lists, {
    where: userId != null ? { id, user_id: userId } : { id },
  })
  if (!row) return null
  return parseRow(row)
}

export async function createList(
  db: { create: Function },
  input: { description: string; items: Array<{ id: string; label: string }> },
  userId?: number,
): Promise<ListRow> {
  let now = Date.now()
  let row = await db.create(
    lists,
    {
      list: input.items,
      description: input.description,
      created_at: now,
      updated_at: now,
      ...(userId != null ? { user_id: userId } : {}),
    },
    { returnRow: true },
  )
  return parseRow(row)
}

export async function updateList(
  db: { findOne: Function; updateMany: Function },
  id: number,
  input: { description: string; items: Array<{ id: string; label: string }> },
  userId?: number,
): Promise<boolean> {
  let where = userId != null ? { id, user_id: userId } : { id }
  let existing = await db.findOne(lists, { where })
  if (!existing) return false

  await db.updateMany(
    lists,
    { list: input.items, description: input.description, updated_at: Date.now() },
    { where },
  )
  return true
}

export async function renameList(
  db: { findOne: Function; updateMany: Function },
  id: number,
  description: string,
  userId?: number,
): Promise<boolean> {
  let where = userId != null ? { id, user_id: userId } : { id }
  let existing = await db.findOne(lists, { where })
  if (!existing) return false

  await db.updateMany(
    lists,
    { description, updated_at: Date.now() },
    { where },
  )
  return true
}

export async function deleteList(
  db: { findOne: Function; delete: Function },
  id: number,
  userId?: number,
): Promise<boolean> {
  let where = userId != null ? { id, user_id: userId } : { id }
  let existing = await db.findOne(lists, { where })
  if (!existing) return false

  await db.delete(lists, where)
  return true
}