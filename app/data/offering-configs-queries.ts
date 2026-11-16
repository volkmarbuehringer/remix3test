import { rawSql, sql, type Database } from 'remix/data-table'
import { compileOrderByDirection } from 'remix/data-table/sql-helpers'
import { z } from 'zod/v4'

import { int8, queryRows, queryRow, int8Aggregate } from './rows.ts'

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
  /**
   * True when the resource already owns a configuration. A resource can hold
   * exactly one row (the controller rejects a duplicate), so the panels use
   * this to disable options the user cannot pick instead of letting them
   * submit into a "bereits konfiguriert" error.
   */
  has_config: boolean
}

const offeringConfigWireSchema = z.object({
  id: z.number(),
  resource_id: z.number(),
  resource_name: z.string().nullable(),
  resource_description: z.string().nullable(),
  rules: z.record(z.string(), z.unknown()),
  created_at: int8,
  updated_at: int8,
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
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  }
}

/**
 * Whitelisted ORDER BY expressions for the offering-configs grid. The map lives
 * in the data layer, not at the call site, so a request-derived `sort` value
 * can never reach the SQL text: the caller picks a key, the data layer picks
 * the expression.
 */
const OFFERING_CONFIGS_ORDER_BY_COLUMNS: Record<string, string> = {
  id: 'oc.id',
  resource_description: 'r.name',
  created_at: 'oc.created_at',
  updated_at: 'oc.updated_at',
}

/** Sortable `sort` params, derived from the ORDER BY whitelist so they cannot drift. */
export const OFFERING_CONFIGS_SORTABLE_FIELDS: readonly string[] = Object.keys(
  OFFERING_CONFIGS_ORDER_BY_COLUMNS,
)

export interface ListOfferingConfigsOpts {
  offset: number
  pageSize: number
  column: string
  direction: 'asc' | 'desc'
  filter?: string
}

/** Longest search value that still narrows anything; longer input is clamped. */
const FILTER_MAX_LENGTH = 200

/**
 * Builds the shared WHERE clause for the grid and its total count.
 *
 * The toolbar advertises a resource search, and the grid shows both the
 * resource name and its description, so a single pattern is matched against
 * both: an admin who knows the room by its description ("Nebenraum", "Beamer")
 * should find its configuration without learning the name first. LIKE
 * wildcards are escaped so `_` / `%` are literal characters, and the value is
 * trimmed and clamped (a 200+ char substring makes the query pointless).
 */
function resourceFilterClause(filter: string | undefined): {
  where: string
  params: unknown[]
} {
  let value = filter?.trim()
  if (!value) return { where: '', params: [] }
  let clamped = value.length > FILTER_MAX_LENGTH ? value.slice(0, FILTER_MAX_LENGTH) : value
  let pattern = `%${clamped.replace(/[%_\\]/g, '\\$&')}%`
  return { where: ' WHERE (r.name ILIKE $1 OR r.description ILIKE $1)', params: [pattern] }
}

export async function countOfferingConfigs(
  db: Database,
  opts: { filter?: string | undefined },
): Promise<number> {
  let { where, params } = resourceFilterClause(opts.filter)
  let query = `
    SELECT COUNT(*) AS count FROM offering_configs oc
    JOIN resources r ON r.id = oc.resource_id${where}
  `
  let rows = await queryRows(db, rawSql(query, params), z.object({ count: int8Aggregate }))
  return rows[0]?.count ?? 0
}

export async function listOfferingConfigs(
  db: Database,
  opts: ListOfferingConfigsOpts,
): Promise<OfferingConfigRow[]> {
  let { offset, pageSize, column, direction, filter } = opts

  let { where, params } = resourceFilterClause(filter)
  let query = `
    SELECT oc.id, oc.resource_id, r.name AS resource_name, r.description AS resource_description,
           oc.rules, oc.created_at, oc.updated_at
    FROM offering_configs oc
    JOIN resources r ON r.id = oc.resource_id${where}
  `

  let orderCol = OFFERING_CONFIGS_ORDER_BY_COLUMNS[column] ?? 'oc.id'
  let orderDir = compileOrderByDirection(direction)
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

/**
 * Every resource plus whether it already has a configuration. The create panel
 * offers only the unconfigured ones; the edit panel additionally allows the row
 * being edited. `name` may be empty for legacy rows (the column is NOT NULL but
 * historically allowed ''), so the panels fall back to the description.
 */
export async function listOfferingConfigResources(
  db: Database,
): Promise<OfferingConfigResourceOption[]> {
  return await queryRows(
    db,
    sql`SELECT r.id, r.name, r.description, (oc.id IS NOT NULL) AS has_config
        FROM resources r
        LEFT JOIN offering_configs oc ON oc.resource_id = r.id
        ORDER BY r.name ASC, r.id ASC`,
    z.object({
      id: z.number(),
      name: z.string(),
      description: z.string(),
      has_config: z.boolean(),
    }),
  )
}
