import { rawSql, sql, type Database, type SqlStatement } from 'remix/data-table'
import { compileOrderByDirection } from 'remix/data-table/sql-helpers'
import { z } from 'zod/v4'
import { getPeriodRange, getTodayUtcMidnight } from '../utils/date-utils.ts'
import { int8, queryRows, queryRow, int8Aggregate } from './rows.ts'

const offeringRowSchema = z.object({
  id: z.number(),
  day: int8,
  resource_id: z.number(),
  resource_name: z.string().nullable(),
  resource_description: z.string().nullable(),
  during: z.string(),
  created_at: int8,
  updated_at: int8,
})

export type OfferingRow = z.output<typeof offeringRowSchema>

const offeringsResourceOptionSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
})

export type OfferingsResourceOption = z.output<typeof offeringsResourceOptionSchema>

interface ListOfferingsOpts {
  offset: number
  pageSize: number
  column: string
  direction: 'asc' | 'desc'
  filter?: string | undefined
  period?: string | undefined
  status?: string | undefined
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

/**
 * Build a safe WHERE fragment for the offerings grid. Every value is bound via
 * a `?` placeholder (resolved by `rawSql`) rather than hand-numbered `$n`
 * positions; the only interpolated text is the static {@link OFFERINGS_SEARCH_COLUMNS}
 * whitelist. `status === 'all'` adds no day filter; the default ("pending") and
 * "expired" compare against the shared UTC-midnight boundary.
 */
function offeringsWhereStatement(opts: {
  filter?: string | undefined
  period?: string | undefined
  status?: string | undefined
}): SqlStatement {
  let conditions: string[] = []
  let values: unknown[] = []

  if (opts.filter) {
    let escaped = opts.filter.slice(0, 200).replace(/[%_\\]/g, '\\$&')
    let searchPattern = `%${escaped}%`
    conditions.push(`(${OFFERINGS_SEARCH_COLUMNS.map((col) => `${col} ILIKE ?`).join(' OR ')})`)
    values.push(searchPattern, searchPattern)
  }

  let periodRange = opts.period ? getPeriodRange(opts.period) : null
  if (periodRange) {
    conditions.push('ao.day >= ? AND ao.day < ?')
    values.push(periodRange.startMs, periodRange.endMs)
  }

  let todayMidnight = getTodayUtcMidnight()
  if (opts.status === 'all') {
    // No day filter — show every offering regardless of date.
  } else if (opts.status === 'pending' || !opts.status) {
    conditions.push('ao.day >= ?')
    values.push(todayMidnight)
  } else if (opts.status === 'expired') {
    conditions.push('ao.day < ?')
    values.push(todayMidnight)
  }

  if (conditions.length === 0) return rawSql('')
  return rawSql(`WHERE ${conditions.join(' AND ')}`, values)
}

export async function listOfferings(
  db: Database,
  opts: ListOfferingsOpts,
): Promise<{ rows: OfferingRow[]; hasMore: boolean }> {
  let { offset, pageSize, column, direction, filter, period, status } = opts

  let orderCol = OFFERINGS_ORDER_BY_COLUMNS[column]
  if (!orderCol) throw new Error(`Invalid sort column: ${column}`)
  let orderDir = compileOrderByDirection(direction)
  let where = offeringsWhereStatement({ filter, period, status })
  let orderBy = rawSql(`ORDER BY ${orderCol} ${orderDir}, id DESC`)

  let rows = await queryRows(
    db,
    sql`SELECT ao.id, ao.day, ao.resource_id, r.name AS resource_name, r.description AS resource_description,
           ao.during, ao.created_at, ao.updated_at
    FROM appointoffering ao
    LEFT JOIN resources r ON r.id = ao.resource_id
    ${where}
    ${orderBy}
    LIMIT ${pageSize + 1} OFFSET ${offset}`,
    offeringRowSchema,
  )
  let hasMore = rows.length > pageSize
  if (hasMore) rows.pop()

  return { rows, hasMore }
}

export async function fetchOfferingEditRow(db: Database, id: string): Promise<OfferingRow | null> {
  return (
    (await queryRow(
      db,
      sql`SELECT ao.id, ao.day, ao.resource_id, r.name AS resource_name, r.description AS resource_description,
            ao.during, ao.created_at, ao.updated_at
     FROM appointoffering ao
     LEFT JOIN resources r ON r.id = ao.resource_id
     WHERE ao.id = ${id}`,
      offeringRowSchema,
    )) ?? null
  )
}

export async function listResources(db: Database): Promise<OfferingsResourceOption[]> {
  return await queryRows(
    db,
    sql`SELECT id, name, description FROM resources ORDER BY name ASC`,
    offeringsResourceOptionSchema,
  )
}

export async function createOffering(
  db: Database,
  data: { dayMs: number; resourceId: number; during: string },
): Promise<number> {
  let now = Date.now()
  let row = await queryRow(
    db,
    sql`INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
     VALUES (${data.dayMs}, ${data.resourceId}, ${data.during}, ${now}, ${now})
     RETURNING id`,
    z.object({ id: z.number() }),
  )
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
  let rows = await queryRows(
    db,
    sql`SELECT resource_id FROM offering_configs`,
    z.object({ resource_id: z.number() }),
  )
  return rows.map((r) => r.resource_id)
}

export async function deletePastOfferings(db: Database): Promise<number> {
  let result = await db.exec('DELETE FROM appointoffering WHERE day < $1', [getTodayUtcMidnight()])
  return result.affectedRows ?? 0
}

export async function countPastOfferings(db: Database): Promise<number> {
  let rows = await queryRows(
    db,
    sql`SELECT COUNT(*) AS count FROM appointoffering WHERE day < ${getTodayUtcMidnight()}`,
    z.object({ count: int8Aggregate }),
  )
  return rows.length > 0 ? rows[0]!.count : 0
}

// ---- helpers (shared with data/offering-configs.ts) ----
