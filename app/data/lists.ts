import { rawSql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { lists } from './schema.ts'
import { queryRows } from './rows.ts'

interface ListItem {
  id: string
  label: string
  done?: boolean
}

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
  user_id: number | null
  list: ListItem[]
  title: string
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
    try {
      list = JSON.parse(list)
    } catch {
      list = []
    }
  }
  return {
    id: Number(row.id),
    user_id: row.user_id != null ? Number(row.user_id) : null,
    list: list as ListItem[],
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  }
}

function assignStableIds(items: Array<{ id?: string; label: string; done?: boolean }>): ListItem[] {
  return items.map((item) => ({
    id:
      item.id && typeof item.id === 'string' && item.id.length > 0 ? item.id : crypto.randomUUID(),
    label: item.label,
    ...(typeof item.done === 'boolean' ? { done: item.done } : {}),
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
    rows = (
      await queryRows(
        db,
        rawSql(
          `SELECT * FROM lists
       WHERE (title ILIKE $1
          OR description ILIKE $1
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(list) item
            WHERE item->>'label' ILIKE $1
          )) ${ownerClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
          args,
        ),
        listWireSchema,
      )
    ).map((row) => parseRow(row as Record<string, unknown>))
    hasMore = rows.length > limit
    if (hasMore) rows.pop()
  } else {
    let raw = await db.findMany(lists, {
      limit: limit + 1,
      offset,
      orderBy: [
        ['created_at', 'desc'],
        ['id', 'desc'],
      ] as const,
      ...(userId != null ? { where: { user_id: userId } } : {}),
    })
    rows = raw.map((r: Record<string, unknown>) => parseRow(r))
    hasMore = rows.length > limit
    if (hasMore) rows.pop()
  }

  return { data: rows, hasMore, offset }
}

export async function getListsByIds(
  db: Database,
  ids: number[],
  userId?: number,
): Promise<ListRow[]> {
  if (ids.length === 0) return []
  let ownerClause = userId != null ? 'AND user_id = $2' : ''
  let params: unknown[] = userId != null ? [ids, userId] : [ids]
  let rows = await queryRows(
    db,
    rawSql(
      `SELECT * FROM lists WHERE id = ANY($1::integer[]) ${ownerClause} ORDER BY array_position($1::integer[], id)`,
      params,
    ),
    listWireSchema,
  )
  return rows.map((row) => parseRow(row as Record<string, unknown>))
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
  input: {
    title?: string
    description: string
    items: Array<{ id?: string; label: string; done?: boolean }>
  },
  userId?: number,
): Promise<ListRow> {
  let now = Date.now()
  let stableItems = assignStableIds(input.items)
  let row = await db.create(
    lists,
    {
      list: stableItems,
      title: input.title ?? '',
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
  partial: {
    title?: string
    description?: string
    items?: Array<{ id?: string; label: string; done?: boolean }>
  },
  userId?: number,
  options?: { expectedUpdatedAt?: number },
): Promise<PatchResult> {
  return await db.transaction(async (tx) => {
    let where = userId != null ? { id, user_id: userId } : { id }
    let args: unknown[] = userId != null ? [id, userId] : [id]
    let locked = await tx.exec(
      `SELECT id FROM lists WHERE id = $1${userId != null ? ' AND user_id = $2' : ''} FOR UPDATE`,
      args,
    )
    if ((locked.rows ?? []).length === 0) return { ok: false, reason: 'not_found' }

    let existing = await tx.findOne(lists, { where })
    if (!existing) return { ok: false, reason: 'not_found' }

    let parsed = parseRow(existing)

    let updateWhere = { ...where }
    if (options?.expectedUpdatedAt != null) {
      if (parsed.updated_at !== options.expectedUpdatedAt) {
        return { ok: false, reason: 'conflict', current: parsed }
      }
      ;(updateWhere as Record<string, unknown>).updated_at = options.expectedUpdatedAt
    }

    let updateFields: Record<string, unknown> = { updated_at: Date.now() }
    if (partial.title !== undefined) {
      updateFields.title = partial.title
    }
    if (partial.description !== undefined) {
      updateFields.description = partial.description
    }
    if (partial.items !== undefined) {
      updateFields.list = assignStableIds(partial.items)
    }

    let writeResult = await tx.updateMany(lists, updateFields, {
      where: updateWhere,
    })
    if (options?.expectedUpdatedAt != null && (writeResult.affectedRows ?? 0) === 0) {
      let current = (await tx.findOne(lists, { where })) as Record<string, unknown>
      return { ok: false, reason: 'conflict', current: parseRow(current) }
    }

    let updated = (await tx.findOne(lists, { where })) as Record<string, unknown> | null
    if (!updated) return { ok: false, reason: 'not_found' }
    return { ok: true, row: parseRow(updated) }
  })
}

export async function deleteList(db: Database, id: number, userId?: number): Promise<boolean> {
  return await db.transaction(async (tx) => {
    let where = userId != null ? { id, user_id: userId } : { id }
    let existing = await tx.findOne(lists, { where })
    if (!existing) return false

    await tx.delete(lists, where)
    return true
  })
}

export type MoveResult =
  | { ok: true; source: ListRow; target: ListRow }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'conflict'; current: ListRow }
  | { ok: false; reason: 'same_list' }
  | { ok: false; reason: 'last_item' }
  | { ok: false; reason: 'item_not_found' }

type MoveFailure = 'not_found' | 'conflict' | 'item_not_found' | 'last_item' | 'same_list'

function throwMoveError(reason: MoveFailure, current?: ListRow): never {
  let error = new Error(reason) as Error & {
    moveReason: MoveFailure
    moveCurrent?: ListRow
  }
  error.moveReason = reason
  error.moveCurrent = current
  throw error
}

export async function moveItemBetweenLists(
  db: Database,
  sourceId: number,
  targetId: number,
  itemId: string,
  userId?: number,
  options?: { expectedUpdatedAt?: number },
): Promise<MoveResult> {
  if (sourceId === targetId) return { ok: false, reason: 'same_list' }

  try {
    return await db.transaction(async (tx) => {
      // Lock both rows up front (in id order to avoid deadlocks) so a concurrent
      // delete of the target between the existence check and the write, or a
      // concurrent move into the same target, cannot corrupt data. FOR UPDATE
      // requires being inside a transaction, which db.transaction provides.
      for (let lockId of [sourceId, targetId].sort((a, b) => a - b)) {
        let args: unknown[] = [lockId]
        let ownerClause = ''
        if (userId != null) {
          args.push(userId)
          ownerClause = ' AND user_id = $2'
        }
        let locked = await tx.exec(
          `SELECT id FROM lists WHERE id = $1${ownerClause} FOR UPDATE`,
          args,
        )
        if ((locked.rows ?? []).length === 0) {
          throwMoveError('not_found')
        }
      }

      let sourceWhere = userId != null ? { id: sourceId, user_id: userId } : { id: sourceId }
      let targetWhere = userId != null ? { id: targetId, user_id: userId } : { id: targetId }

      let sourceRow = await tx.findOne(lists, { where: sourceWhere })
      let targetRow = await tx.findOne(lists, { where: targetWhere })
      if (!sourceRow || !targetRow) throwMoveError('not_found')

      let parsedSource = parseRow(sourceRow)
      let parsedTarget = parseRow(targetRow)

      let expectedUpdatedAt = options?.expectedUpdatedAt
      let updateSourceWhere = { ...sourceWhere }
      if (expectedUpdatedAt != null) {
        if (parsedSource.updated_at !== expectedUpdatedAt) {
          throwMoveError('conflict', parsedSource)
        }
        ;(updateSourceWhere as Record<string, unknown>).updated_at = expectedUpdatedAt
      }

      let matchIndex = parsedSource.list.findIndex((entry) => entry.id === itemId)
      if (matchIndex === -1) throwMoveError('item_not_found')
      let item = parsedSource.list[matchIndex]

      if (parsedSource.list.length === 1) throwMoveError('last_item')

      let now = Date.now()
      let nextSource = [...parsedSource.list]
      nextSource.splice(matchIndex, 1)
      let nextTarget = [...parsedTarget.list, item]

      let sourceWrite = await tx.updateMany(
        lists,
        { list: nextSource, updated_at: now },
        { where: updateSourceWhere },
      )
      if (expectedUpdatedAt != null && (sourceWrite.affectedRows ?? 0) === 0) {
        let current = (await tx.findOne(lists, {
          where: sourceWhere,
        })) as Record<string, unknown> | null
        if (!current) throwMoveError('not_found')
        throwMoveError('conflict', parseRow(current))
      }

      let targetWrite = await tx.updateMany(
        lists,
        { list: nextTarget, updated_at: now },
        { where: targetWhere },
      )
      if ((targetWrite.affectedRows ?? 0) === 0) throwMoveError('not_found')

      let updatedSource = (await tx.findOne(lists, {
        where: sourceWhere,
      })) as Record<string, unknown> | null
      let updatedTarget = (await tx.findOne(lists, {
        where: targetWhere,
      })) as Record<string, unknown> | null
      if (!updatedSource || !updatedTarget) throwMoveError('not_found')
      return {
        ok: true,
        source: parseRow(updatedSource),
        target: parseRow(updatedTarget),
      }
    })
  } catch (error) {
    if (error instanceof Error && 'moveReason' in error) {
      let typed = error as Error & {
        moveReason: MoveFailure
        moveCurrent?: ListRow
      }
      switch (typed.moveReason) {
        case 'not_found':
          return { ok: false, reason: 'not_found' }
        case 'conflict':
          return typed.moveCurrent
            ? { ok: false, reason: 'conflict', current: typed.moveCurrent }
            : { ok: false, reason: 'not_found' }
        case 'item_not_found':
          return { ok: false, reason: 'item_not_found' }
        case 'last_item':
          return { ok: false, reason: 'last_item' }
        case 'same_list':
          return { ok: false, reason: 'same_list' }
      }
    }
    throw error
  }
}
