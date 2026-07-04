import { type Database } from 'remix/data-table'
import { lists } from './schema.ts'

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

export type PatchResult =
  | { ok: true; row: ListRow }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'conflict'; current: ListRow }

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

function assignStableIds(
  items: Array<{ id?: string; label: string }>,
): Array<{ id: string; label: string }> {
  return items.map((item) => ({
    id: item.id && typeof item.id === 'string' && item.id.length > 0
      ? item.id
      : crypto.randomUUID(),
    label: item.label,
  }))
}

export async function getAllLists(
  db: Database,
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
    let esc = filter.replace(/[%_\\]/g, '\\$&')
    let searchPattern = `%${esc}%`
    let args: unknown[] = [searchPattern, limit + 1, offset]
    let ownerClause = ''
    if (userId != null) {
      args.push(userId)
      ownerClause = 'AND user_id = $4'
    }
    let result = await db.exec(
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
    rows = (result.rows ?? []).map(parseRow)
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
  db: Database,
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
  db: Database,
  input: { description: string; items: Array<{ id?: string; label: string }> },
  userId?: number,
): Promise<ListRow> {
  let now = Date.now()
  let stableItems = assignStableIds(input.items)
  let row = await db.create(
    lists,
    {
      list: stableItems,
      description: input.description,
      created_at: now,
      updated_at: now,
      ...(userId != null ? { user_id: userId } : {}),
    },
    { returnRow: true },
  )
  return parseRow(row)
}

export async function patchList(
  db: Database,
  id: number,
  partial: { description?: string; items?: Array<{ id?: string; label: string }> },
  userId?: number,
  options?: { expectedUpdatedAt?: number },
): Promise<PatchResult> {
  let where = userId != null ? { id, user_id: userId } : { id }
  let existing = await db.findOne(lists, { where })
  if (!existing) return { ok: false, reason: 'not_found' }

  let parsed = parseRow(existing)

  let updateWhere = { ...where }
  if (options?.expectedUpdatedAt != null) {
    if (parsed.updated_at !== options.expectedUpdatedAt) {
      return { ok: false, reason: 'conflict', current: parsed }
    }
    (updateWhere as Record<string, unknown>).updated_at = options.expectedUpdatedAt
  }

  let updateFields: Record<string, unknown> = { updated_at: Date.now() }
  if (partial.description !== undefined) {
    updateFields.description = partial.description
  }
  if (partial.items !== undefined) {
    updateFields.list = assignStableIds(partial.items)
  }

  let writeResult = await db.updateMany(lists, updateFields, { where: updateWhere })
  if (options?.expectedUpdatedAt != null && (writeResult.affectedRows ?? 0) === 0) {
    let current = await db.findOne(lists, { where }) as Record<string, unknown>
    return { ok: false, reason: 'conflict', current: parseRow(current) }
  }

  let updated = await db.findOne(lists, { where }) as Record<string, unknown>
  return { ok: true, row: parseRow(updated) }
}

export async function deleteList(
  db: Database,
  id: number,
  userId?: number,
): Promise<boolean> {
  let where = userId != null ? { id, user_id: userId } : { id }
  let existing = await db.findOne(lists, { where })
  if (!existing) return false

  await db.delete(lists, where)
  return true
}
