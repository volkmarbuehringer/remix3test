import { rawSql, sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { queryRows, queryRow, int8Aggregate } from './rows.ts'

export interface OfferingConfigRow {
  id: number
  resource_id: number
  resource_name: string | null
  resource_description: string | null
  rules: Record<string, [number, number]>
  created_at: number
  updated_at: number
}

export interface OfferingConfigResourceOption {
  id: number
  name: string
  description: string
}

const offeringConfigWireSchema = z.object({
  id: z.number(),
  resource_id: z.number(),
  resource_name: z.string().nullable(),
  resource_description: z.string().nullable(),
  rules: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
})

function parseRules(raw: unknown): Record<string, [number, number]> {
  let obj: Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return {}
    }
  } else if (typeof raw === 'object' && raw !== null) {
    obj = raw as Record<string, unknown>
  } else {
    return {}
  }
  let result: Record<string, [number, number]> = {}
  for (let [k, v] of Object.entries(obj)) {
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === 'number' &&
      typeof v[1] === 'number'
    ) {
      result[k] = v as [number, number]
    }
  }
  return result
}

export function toOfferingConfigRow(row: Record<string, unknown>): OfferingConfigRow {
  return {
    id: Number(row.id),
    resource_id: Number(row.resource_id),
    resource_name: (row.resource_name as string) ?? null,
    resource_description: (row.resource_description as string) ?? null,
    rules: parseRules(row.rules),
    created_at:
      typeof row.created_at === 'string' ? Number(row.created_at) : (row.created_at as number),
    updated_at:
      typeof row.updated_at === 'string' ? Number(row.updated_at) : (row.updated_at as number),
  }
}

export interface ListOfferingConfigsOpts {
  offset: number
  pageSize: number
  column: string
  direction: 'asc' | 'desc'
  filter?: string
  orderByColumns: Record<string, string>
}

export async function countOfferingConfigs(
  db: Database,
  opts: { filter?: string },
): Promise<number> {
  let query = `
    SELECT COUNT(*) AS count FROM offering_configs oc
    JOIN resources r ON r.id = oc.resource_id
  `
  let params: unknown[] = []
  if (opts.filter && opts.filter.length <= 200) {
    let esc = opts.filter.slice(0, 200).replace(/[%_\\]/g, '\\$&')
    query += ' WHERE r.name ILIKE $1'
    params.push(`%${esc}%`)
  }
  let rows = await queryRows(db, rawSql(query, params), z.object({ count: int8Aggregate }))
  return rows.length > 0 ? rows[0].count : 0
}

export async function listOfferingConfigs(
  db: Database,
  opts: ListOfferingConfigsOpts,
): Promise<OfferingConfigRow[]> {
  let { offset, pageSize, column, direction, filter, orderByColumns } = opts

  let query = `
    SELECT oc.id, oc.resource_id, r.name AS resource_name, r.description AS resource_description,
           oc.rules, oc.created_at, oc.updated_at
    FROM offering_configs oc
    JOIN resources r ON r.id = oc.resource_id
  `
  let params: unknown[] = []
  if (filter && filter.length <= 200) {
    let esc = filter.slice(0, 200).replace(/[%_\\]/g, '\\$&')
    query += ' WHERE r.name ILIKE $1'
    params.push(`%${esc}%`)
  }

  let orderCol = orderByColumns[column] || 'oc.id'
  let orderDir = direction === 'desc' ? 'DESC' : 'ASC'
  query += ` ORDER BY ${orderCol} ${orderDir}`
  query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  params.push(pageSize, offset)

  let rows = await queryRows(db, rawSql(query, params), offeringConfigWireSchema)
  return rows.map((row) => toOfferingConfigRow(row as Record<string, unknown>))
}

export async function getOfferingConfig(
  db: Database,
  id: number,
): Promise<OfferingConfigRow | undefined> {
  let row = await queryRow(
    db,
    sql`SELECT oc.id, oc.resource_id, r.name AS resource_name, r.description AS resource_description, oc.rules, oc.created_at, oc.updated_at
     FROM offering_configs oc
     JOIN resources r ON r.id = oc.resource_id
     WHERE oc.id = ${id}`,
    offeringConfigWireSchema,
  )
  return row ? toOfferingConfigRow(row as Record<string, unknown>) : undefined
}

export async function listOfferingConfigResources(
  db: Database,
): Promise<OfferingConfigResourceOption[]> {
  return await queryRows(
    db,
    sql`SELECT id, name, description FROM resources ORDER BY name ASC`,
    z.object({ id: z.number(), name: z.string(), description: z.string() }),
  )
}
