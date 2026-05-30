import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { adminRoutes as routes } from '../routes.ts'
import { offeringConfigs, resources } from '../data/schema.ts'
import type { AppContext } from '../types/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { renderAdminPage } from '../ui/admin-layout.tsx'
import { AdminOfferingConfigsPage } from '../ui/admin-offering-configs-page.tsx'
import { parseSort } from '../utils/sort-params.ts'
import {
  gridStateFromForm,
  gridStateFromFormData,
  gridStateToParams,
} from '../utils/grid-state.ts'
import { pool } from '../data/setup.ts'

export interface OfferingConfigRow {
  id: number
  resource_id: number
  resource_description: string | null
  rules: Record<string, [number, number]>
  created_at: number
  updated_at: number
}

export interface ResourceOption {
  id: number
  description: string
}

const PAGE_SIZE = 15

const SORTABLE_FIELDS = ['id', 'resource_description', 'created_at', 'updated_at'] as const

const ORDER_BY_COLUMNS: Record<string, string> = {
  id: 'oc.id',
  resource_description: 'r.description',
  created_at: 'oc.created_at',
  updated_at: 'oc.updated_at',
}

const PG_FOREIGN_KEY_VIOLATION = '23503'

function isForeignKeyViolation(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as { code?: string }
    return err.code === PG_FOREIGN_KEY_VIOLATION
  }
  return false
}

const offeringConfigSchema = f.object({
  resource_id: f.field(s.string()),
  monday_enabled: f.field(s.defaulted(s.string(), '')),
  monday_start: f.field(s.defaulted(s.string(), '')),
  monday_end: f.field(s.defaulted(s.string(), '')),
  tuesday_enabled: f.field(s.defaulted(s.string(), '')),
  tuesday_start: f.field(s.defaulted(s.string(), '')),
  tuesday_end: f.field(s.defaulted(s.string(), '')),
  wednesday_enabled: f.field(s.defaulted(s.string(), '')),
  wednesday_start: f.field(s.defaulted(s.string(), '')),
  wednesday_end: f.field(s.defaulted(s.string(), '')),
  thursday_enabled: f.field(s.defaulted(s.string(), '')),
  thursday_start: f.field(s.defaulted(s.string(), '')),
  thursday_end: f.field(s.defaulted(s.string(), '')),
  friday_enabled: f.field(s.defaulted(s.string(), '')),
  friday_start: f.field(s.defaulted(s.string(), '')),
  friday_end: f.field(s.defaulted(s.string(), '')),
  saturday_enabled: f.field(s.defaulted(s.string(), '')),
  saturday_start: f.field(s.defaulted(s.string(), '')),
  saturday_end: f.field(s.defaulted(s.string(), '')),
  sunday_enabled: f.field(s.defaulted(s.string(), '')),
  sunday_start: f.field(s.defaulted(s.string(), '')),
  sunday_end: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

function rulesFromParsed(parsed: Record<string, string>): Record<string, [number, number]> {
  let rules: Record<string, [number, number]> = {}
  for (let day of DAY_KEYS) {
    let enabled = parsed[`${day}_enabled`]
    if (enabled !== '1') continue
    let start = parsed[`${day}_start`]
    let end = parsed[`${day}_end`]
    if (start && end) {
      let startMin = Number(start)
      let endMin = Number(end)
      if (Number.isFinite(startMin) && Number.isFinite(endMin) && startMin >= 0 && endMin <= 1440 && startMin < endMin) {
        rules[day] = [startMin, endMin]
      }
    }
  }
  return rules
}

function toRow(row: Record<string, unknown>): OfferingConfigRow {
  return {
    id: Number(row.id),
    resource_id: Number(row.resource_id),
    resource_description: (row.resource_description as string) ?? null,
    rules: typeof row.rules === 'string' ? JSON.parse(row.rules as string) : (row.rules as Record<string, [number, number]>),
    created_at: typeof row.created_at === 'string' ? Number(row.created_at) : (row.created_at as number),
    updated_at: typeof row.updated_at === 'string' ? Number(row.updated_at) : (row.updated_at as number),
  }
}

export default createController<typeof routes.admin.offeringConfigs, AppContext>(routes.admin.offeringConfigs, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'id',
        defaultDirection: 'asc',
      })

      let whereClause = ''
      let params: unknown[] = []
      if (filter) {
        whereClause = 'WHERE r.description ILIKE $1'
        params.push(`%${filter}%`)
      }

      let orderCol = ORDER_BY_COLUMNS[column] || 'oc.id'
      let orderDir = direction === 'desc' ? 'DESC' : 'ASC'

      let countResult = await pool.query(
        `SELECT COUNT(*) FROM offering_configs oc
         JOIN resources r ON r.id = oc.resource_id
         ${whereClause}`,
        params,
      )
      let totalRows = Number(countResult.rows[0]?.count ?? 0)
      let hasMore = offset + PAGE_SIZE < totalRows

      let dataParams = [...params, PAGE_SIZE + 1, offset]
      let dataResult = await pool.query(
        `SELECT oc.id, oc.resource_id, r.description AS resource_description, oc.rules, oc.created_at, oc.updated_at
         FROM offering_configs oc
         JOIN resources r ON r.id = oc.resource_id
         ${whereClause}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        dataParams,
      )

      let rows: OfferingConfigRow[] = dataResult.rows.map(toRow)

      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam ? Number(editingParam) : null
      let editRow: OfferingConfigRow | null = null
      if (editingRowId && Number.isFinite(editingRowId)) {
        let editResult = await pool.query(
          `SELECT oc.id, oc.resource_id, r.description AS resource_description, oc.rules, oc.created_at, oc.updated_at
           FROM offering_configs oc
           JOIN resources r ON r.id = oc.resource_id
           WHERE oc.id = $1`,
          [editingRowId],
        )
        if (editResult.rows.length > 0) {
          editRow = toRow(editResult.rows[0] as Record<string, unknown>)
        }
      }

      let creating = context.url.searchParams.get('creating') === 'true'

      let resourcesResult = await pool.query(
        'SELECT id, description FROM resources ORDER BY description ASC',
      )
      let resourceOptions: ResourceOption[] = resourcesResult.rows.map((r: Record<string, unknown>) => ({
        id: Number(r.id),
        description: r.description as string,
      }))

      return renderAdminPage(
        context.render,
        'offeringConfigs',
        <AdminOfferingConfigsPage
          rows={rows}
          offset={offset}
          hasMore={hasMore}
          prevOffset={Math.max(0, offset - PAGE_SIZE)}
          nextOffset={offset + PAGE_SIZE}
          sortColumn={column}
          sortDirection={direction}
          filter={filter}
          editRow={editRow}
          creating={creating}
          resources={resourceOptions}
        />,
      )
    },

    async create(context) {
      let db = context.db
      let formData = context.formData

      let parsed: Record<string, string>
      try {
        parsed = s.parse(offeringConfigSchema, formData) as Record<string, string>
      } catch {
        return context.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }

      let resourceId = Number(parsed.resource_id)
      if (!resourceId || !Number.isFinite(resourceId)) {
        return context.json({ ok: false, error: 'Resource is required' }, { status: 400 })
      }

      let resource = await db.findOne(resources, { where: { id: resourceId } })
      if (!resource) {
        return context.json({ ok: false, error: 'Resource not found' }, { status: 404 })
      }

      let existing = await db.findOne(offeringConfigs, { where: { resource_id: resourceId } })
      if (existing) {
        return context.json({ ok: false, error: 'Resource already has a config' }, { status: 400 })
      }

      let rules = rulesFromParsed(parsed)
      if (Object.keys(rules).length === 0) {
        return context.json({ ok: false, error: 'At least one day must have a time range' }, { status: 400 })
      }

      let row: Record<string, unknown>
      try {
        row = await db.create(
          offeringConfigs,
          {
            resource_id: resourceId,
            rules: JSON.stringify(rules),
          },
          { returnRow: true },
        )
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          return context.json({ ok: false, error: 'Resource was deleted' }, { status: 409 })
        }
        throw error
      }

      let redirectState = gridStateFromForm(parsed)
      let params = gridStateToParams(redirectState)
      params.set('editing', String(row.id))
      let baseUrl = routes.admin.offeringConfigs.index.href()
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + '?' + params.toString() },
      })
    },

    async update(context) {
      let db = context.db
      let formData = context.formData

      let id = Number(context.params.id)
      if (!Number.isFinite(id) || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let target = await db.findOne(offeringConfigs, { where: { id } })
      if (!target) {
        return context.json({ ok: false, error: 'Config not found' }, { status: 404 })
      }

      let parsed: Record<string, string>
      try {
        parsed = s.parse(offeringConfigSchema, formData) as Record<string, string>
      } catch {
        return context.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }

      let resourceId = Number(parsed.resource_id)
      if (!resourceId || !Number.isFinite(resourceId)) {
        return context.json({ ok: false, error: 'Resource is required' }, { status: 400 })
      }

      let resource = await db.findOne(resources, { where: { id: resourceId } })
      if (!resource) {
        return context.json({ ok: false, error: 'Resource not found' }, { status: 404 })
      }

      let existing = await db.findOne(offeringConfigs, { where: { resource_id: resourceId } })
      if (existing && Number(existing.id) !== id) {
        return context.json({ ok: false, error: 'Resource already has a config' }, { status: 400 })
      }

      let rules = rulesFromParsed(parsed)
      if (Object.keys(rules).length === 0) {
        return context.json({ ok: false, error: 'At least one day must have a time range' }, { status: 400 })
      }

      try {
        await db.updateMany(
          offeringConfigs,
          { resource_id: resourceId, rules: JSON.stringify(rules) },
          { where: { id } },
        )
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          return context.json({ ok: false, error: 'Resource was deleted' }, { status: 409 })
        }
        throw error
      }

      let redirectState = gridStateFromForm(parsed)
      let params = gridStateToParams(redirectState)
      let qs = params.toString()
      let baseUrl = routes.admin.offeringConfigs.index.href()
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + (qs ? '?' + qs : '') },
      })
    },

    async destroy(context) {
      let db = context.db
      let formData = context.formData

      let id = Number(context.params.id)
      if (!Number.isFinite(id) || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let existing = await db.findOne(offeringConfigs, { where: { id } })
      if (!existing) {
        return context.json({ ok: false, error: 'Config not found' }, { status: 404 })
      }

      await db.deleteMany(offeringConfigs, { where: { id } })

      let redirectState = gridStateFromFormData(formData)
      let params = gridStateToParams(redirectState)
      let qs = params.toString()
      let baseUrl = routes.admin.offeringConfigs.index.href()
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + (qs ? '?' + qs : '') },
      })
    },
  },
})
