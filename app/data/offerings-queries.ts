import { type Database } from 'remix/data-table'
import { getPeriodRange, getTodayUtcMidnight } from '../utils/date-utils.ts'

export interface OfferingRow {
  id: string
  day: string
  resource_id: string
  resource_name: string | null
  resource_description: string | null
  during: string
  created_at: string
  updated_at: string
}

export interface OfferingsResourceOption {
  id: string
  name: string
  description: string
}

export interface ListOfferingsOpts {
  offset: number
  pageSize: number
  column: string
  direction: 'asc' | 'desc'
  filter?: string
  period?: string
  status?: string
}

const OFFERINGS_ORDER_BY_COLUMNS: Record<string, string> = {
  'ao.id': 'ao.id',
  'ao.day': 'ao.day',
  'ao.resource_id': 'ao.resource_id',
  'r.description': 'r.name', // UI "description" column sorts by resource name
  'ao.during': 'ao.during',
  'ao.created_at': 'ao.created_at',
  'ao.updated_at': 'ao.updated_at',
}

const OFFERINGS_SEARCH_COLUMNS = ['r.name', 'r.description'] as const

export async function listOfferings(
  db: Database,
  opts: ListOfferingsOpts,
): Promise<{ rows: OfferingRow[]; hasMore: boolean }> {
  let { offset, pageSize, column, direction, filter, period, status } = opts

  let query = `
    SELECT ao.id, ao.day, ao.resource_id, r.name AS resource_name, r.description AS resource_description,
           ao.during, ao.created_at, ao.updated_at
    FROM appointoffering ao
    LEFT JOIN resources r ON r.id = ao.resource_id
  `

  let queryParams: unknown[] = []
  let paramIndex = 0
  let hasWhere = false

  if (filter) {
    paramIndex++
    let escaped = filter.slice(0, 200).replace(/[%_\\]/g, '\\$&')
    let searchPattern = `%${escaped}%`
    let conditions = OFFERINGS_SEARCH_COLUMNS.map((col) => `${col} ILIKE $${paramIndex}`)
    query += ` WHERE (${conditions.join(' OR ')})`
    queryParams.push(searchPattern)
    hasWhere = true
  }

  let periodRange = period ? getPeriodRange(period) : null
  if (periodRange) {
    paramIndex++
    if (hasWhere) {
      query += ` AND ao.day >= $${paramIndex}`
    } else {
      query += ` WHERE ao.day >= $${paramIndex}`
      hasWhere = true
    }
    queryParams.push(periodRange.startMs)

    paramIndex++
    query += ` AND ao.day < $${paramIndex}`
    queryParams.push(periodRange.endMs)
  }

  let todayMidnight = getTodayUtcMidnight()
  if (status === 'pending' || !status) {
    paramIndex++
    if (hasWhere) {
      query += ` AND ao.day >= $${paramIndex}`
    } else {
      query += ` WHERE ao.day >= $${paramIndex}`
    }
    queryParams.push(todayMidnight)
  } else if (status === 'expired') {
    paramIndex++
    if (hasWhere) {
      query += ` AND ao.day < $${paramIndex}`
    } else {
      query += ` WHERE ao.day < $${paramIndex}`
    }
    queryParams.push(todayMidnight)
  }

  paramIndex++
  let orderCol = OFFERINGS_ORDER_BY_COLUMNS[column]
  if (!orderCol) throw new Error(`Invalid sort column: ${column}`)
  query += ` ORDER BY ${orderCol} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  queryParams.push(pageSize + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  queryParams.push(offset)

  let result = await db.exec(query, queryParams)
  let rows = (result.rows ?? []) as unknown as OfferingRow[]
  let hasMore = rows.length > pageSize
  if (hasMore) rows.pop()

  return { rows, hasMore }
}

export async function fetchOfferingEditRow(db: Database, id: string): Promise<OfferingRow | null> {
  let result = await db.exec(
    `SELECT ao.id, ao.day, ao.resource_id, r.name AS resource_name, r.description AS resource_description,
            ao.during, ao.created_at, ao.updated_at
     FROM appointoffering ao
     LEFT JOIN resources r ON r.id = ao.resource_id
     WHERE ao.id = $1`,
    [id],
  )
  return (result.rows ?? []).length > 0 ? (result.rows![0] as unknown as OfferingRow) : null
}

export async function listResources(db: Database): Promise<OfferingsResourceOption[]> {
  let result = await db.exec('SELECT id, name, description FROM resources ORDER BY name ASC')
  return (result.rows ?? []) as unknown as OfferingsResourceOption[]
}

export async function createOffering(
  db: Database,
  data: { dayMs: number; resourceId: number; during: string },
): Promise<number> {
  let now = Date.now()
  let result = await db.exec(
    `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [data.dayMs, data.resourceId, data.during, now, now],
  )
  let row = result.rows?.[0] as { id: number } | undefined
  if (!row) throw new Error('createOffering: INSERT … RETURNING produced no row')
  return row.id
}

export async function updateOffering(
  db: Database,
  id: string,
  data: { dayMs: number; resourceId: number; during: string },
): Promise<boolean> {
  let now = Date.now()
  let result = await db.exec(
    `UPDATE appointoffering
     SET day = $1, resource_id = $2, during = $3, updated_at = $4
     WHERE id = $5`,
    [data.dayMs, data.resourceId, data.during, now, id],
  )
  return (result.affectedRows ?? 0) > 0
}

export async function deleteOffering(db: Database, id: string): Promise<boolean> {
  let result = await db.exec('DELETE FROM appointoffering WHERE id = $1', [id])
  return (result.affectedRows ?? 0) > 0
}

export async function listResourceIdsWithConfigs(db: Database): Promise<number[]> {
  let result = await db.exec('SELECT resource_id FROM offering_configs')
  return (result.rows ?? []).map((r: Record<string, unknown>) => r.resource_id as number)
}

export async function deletePastOfferings(db: Database): Promise<number> {
  let result = await db.exec('DELETE FROM appointoffering WHERE day < $1', [getTodayUtcMidnight()])
  return result.affectedRows ?? 0
}

// ---- helpers (shared with data/offering-configs.ts) ----
