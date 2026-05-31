import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { adminRoutes as routes } from '../routes.ts'
import { pool } from '../data/setup.ts'
import type { AppContext } from '../types/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { renderAdminPage } from '../ui/admin-layout.tsx'
import { AdminOfferingsPage } from '../ui/admin-offerings-page.tsx'
import { parseSort } from '../utils/sort-params.ts'
import { gridStateToParams } from '../utils/grid-state.ts'
import { isDateInPast } from '../utils/date-utils.ts'
import { getConfig, upsertConfig, generateWeek } from '../data/offering-configs.ts'
import type { OfferingConfig } from '../data/offering-configs.ts'
import Holidays from 'date-holidays'
import { logAdminAction } from '../data/audit-log.ts'

const hd = new Holidays('DE', 'rp')

const PAGE_SIZE = 12

const ORDER_BY_COLUMNS: Record<string, string> = {
  'ao.id': 'ao.id',
  'ao.day': 'ao.day',
  'ao.resource_id': 'ao.resource_id',
  'r.description': 'r.description',
  'ao.during': 'ao.during',
  'ao.created_at': 'ao.created_at',
  'ao.updated_at': 'ao.updated_at',
}

const SEARCH_COLUMNS = ['r.description'] as const

export interface OfferingRow {
  id: string
  day: string
  resource_id: string
  resource_description: string | null
  during: string
  created_at: string
  updated_at: string
}

export interface ResourceOption {
  id: string
  description: string
}

// ── Form schema ──────────────────────────────────────────────────

const offeringSaveSchema = f.object({
  resource_id: f.field(s.string()),
  day: f.field(s.string()),
  start_min: f.field(s.string()),
  end_min: f.field(s.string()),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

// ── Validation helpers ───────────────────────────────────────────

function validateOfferingForm(parsed: Record<string, string>): string | null {
  let resourceId = parseInt(parsed.resource_id, 10)
  if (!resourceId || isNaN(resourceId)) {
    return 'Ressource ist erforderlich.'
  }

  if (!parsed.day || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.day)) {
    return 'Gültiges Datum erforderlich (YYYY-MM-DD).'
  }

  let startMin = parseInt(parsed.start_min, 10)
  if (isNaN(startMin) || startMin < 0 || startMin > 1380 || startMin % 60 !== 0) {
    return 'Startzeit ist ungültig.'
  }

  let endMin = parseInt(parsed.end_min, 10)
  if (isNaN(endMin) || endMin < 60 || endMin > 1440 || endMin % 60 !== 0) {
    return 'Endzeit ist ungültig.'
  }

  if (endMin <= startMin) {
    return 'Endzeit muss nach der Startzeit liegen.'
  }

  return null
}

function parseDuring(during: string): { startMin: number; endMin: number } {
  let match = during.match(/^\[(\d+),(\d+)\)$/)
  if (match) {
    return { startMin: parseInt(match[1], 10), endMin: parseInt(match[2], 10) }
  }
  return { startMin: 0, endMin: 60 }
}

function formatTime(minutes: number): string {
  let h = Math.floor(minutes / 60)
  let m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function isExclusionConstraintError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as { code?: string; message?: string; constraint?: string }
    return (
      // Locale-independent: check by constraint name
      err.constraint === 'no_overlapping_seats' ||
      // PostgreSQL exclusion violation error code
      err.code === '23P01' ||
      // Fallback: English error message (only works in English locales)
      (err.message ?? '').includes('conflicts with key')
    )
  }
  return false
}

// ── Controller ───────────────────────────────────────────────────

export default createController<typeof routes.admin.offerings, AppContext>(
  routes.admin.offerings,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async index(context) {
        let offset = Math.max(
          0,
          Number(context.url.searchParams.get('offset')) || 0,
        )
        let filter = context.url.searchParams.get('filter') || undefined

        let { column, direction } = parseSort(context.url, {
          allowedColumns: Object.keys(ORDER_BY_COLUMNS),
          defaultColumn: 'ao.day',
          defaultDirection: 'asc',
        })

        let query = `
          SELECT ao.id, ao.day, ao.resource_id, r.description AS resource_description,
                 ao.during, ao.created_at, ao.updated_at
          FROM appointoffering ao
          LEFT JOIN resources r ON r.id = ao.resource_id
        `

        let params: unknown[] = []
        let paramIndex = 0

        if (filter && filter.length <= 200) {
          paramIndex++
          let searchPattern = `%${filter}%`
          let conditions = SEARCH_COLUMNS.map(
            (col) => `${col} ILIKE $${paramIndex}`,
          )
          query += ` WHERE (${conditions.join(' OR ')})`
          params.push(searchPattern)
        }

        paramIndex++
        query += ` ORDER BY ${ORDER_BY_COLUMNS[column] || 'ao.day'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
        query += ` LIMIT $${paramIndex}`
        params.push(PAGE_SIZE + 1)

        paramIndex++
        query += ` OFFSET $${paramIndex}`
        params.push(offset)

        let result = await pool.query(query, params)
        let rows = result.rows as OfferingRow[]
        let hasMore = rows.length > PAGE_SIZE
        if (hasMore) rows.pop()

        // Load resources for dropdown
        let resourcesResult = await pool.query(
          'SELECT id, description FROM resources ORDER BY description ASC',
        )
        let resources = resourcesResult.rows as ResourceOption[]

        // Check for inline editing state
        let editingParam = context.url.searchParams.get('editing')
        let editingRowId = editingParam || null
        let editRow: OfferingRow | null = null
        if (editingRowId) {
          let editResult = await pool.query(
            `SELECT ao.id, ao.day, ao.resource_id, r.description AS resource_description,
                    ao.during, ao.created_at, ao.updated_at
             FROM appointoffering ao
             LEFT JOIN resources r ON r.id = ao.resource_id
             WHERE ao.id = $1`,
            [editingRowId],
          )
          if (editResult.rows.length > 0) {
            editRow = editResult.rows[0] as OfferingRow
          }
        }

        let creating =
          context.url.searchParams.get('creating') === 'true'
        let error = context.url.searchParams.get('error') || undefined
        let configResourceId = context.url.searchParams.get('config')
        let addWeek = context.url.searchParams.get('addweek') === 'true'

        // Load offering config for config editing
        let offeringConfig: OfferingConfig | null = null
        if (configResourceId) {
          let rid = parseInt(configResourceId, 10)
          if (!isNaN(rid)) {
            offeringConfig = await getConfig(context.db, rid)
          }
        }

        return renderAdminPage(
          context.render,
          'offerings',
          <AdminOfferingsPage
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
            resources={resources}
            error={error}
            configResourceId={configResourceId ? parseInt(configResourceId, 10) : undefined}
            offeringConfig={offeringConfig ?? undefined}
            addWeek={addWeek}
          />,
        )
      },

      async create(context) {
        let formData = context.formData

        let parsed: Record<string, string>
        try {
          parsed = s.parse(offeringSaveSchema, formData) as Record<string, string>
        } catch {
          return context.json(
            { ok: false, error: 'Ungültige Formulardaten.' },
            { status: 400 },
          )
        }

        let validationError = validateOfferingForm(parsed)
        if (validationError) {
          return context.json({ ok: false, error: validationError }, { status: 400 })
        }

        // Reject offerings on public holidays
        if (hd.isHoliday(new Date(parsed.day + 'T00:00:00Z'))) {
          let backState = {
            offset: parsed._offset,
            sort: parsed._sort,
            order: parsed._order,
            filter: parsed._filter,
          }
          let backParams = gridStateToParams(backState)
          backParams.set('creating', 'true')
          backParams.set('error', 'Dieses Datum ist ein Feiertag.')
          let backQs = backParams.toString()
          return new Response(null, {
            status: 302,
            headers: { Location: '/admin/offerings' + (backQs ? '?' + backQs : '') },
          })
        }

        let resourceId = parseInt(parsed.resource_id, 10)
        let dayMs = new Date(parsed.day + 'T00:00:00Z').getTime()
        let startMin = parseInt(parsed.start_min, 10)
        let endMin = parseInt(parsed.end_min, 10)

        // Reject past-date creation
        if (isDateInPast(dayMs)) {
          let backState = {
            offset: parsed._offset,
            sort: parsed._sort,
            order: parsed._order,
            filter: parsed._filter,
          }
          let backParams = gridStateToParams(backState)
          backParams.set('creating', 'true')
          backParams.set('error', 'Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden.')
          let backQs = backParams.toString()
          return new Response(null, {
            status: 302,
            headers: { Location: '/admin/offerings' + (backQs ? '?' + backQs : '') },
          })
        }

        let during = `[${startMin},${endMin})`
        let now = Date.now()
        let newId: number

        try {
          let insertResult = await pool.query(
            `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [dayMs, resourceId, during, now, now],
          )
          newId = insertResult.rows[0].id

          let auth = context.auth
          let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'create',
              target_type: 'appointoffering',
              target_id: newId,
              details: { resource_id: resourceId, day: parsed.day, during },
            })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            let backState = {
              offset: parsed._offset,
              sort: parsed._sort,
              order: parsed._order,
              filter: parsed._filter,
            }
            let backParams = gridStateToParams(backState)
            backParams.set('creating', 'true')
            backParams.set('error', 'Dieser Zeitraum überschneidet sich mit einem bestehenden Angebot.')
            let backQs = backParams.toString()
            return new Response(null, {
              status: 302,
              headers: { Location: '/admin/offerings' + (backQs ? '?' + backQs : '') },
            })
          }
          throw error
        }

        // Redirect back with preserved grid state, showing the new record in edit mode
        let redirectState = {
          offset: parsed._offset,
          sort: parsed._sort,
          order: parsed._order,
          filter: parsed._filter,
        }
        let params = gridStateToParams(redirectState)
        params.set('editing', String(newId))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: '/admin/offerings' + (qs ? '?' + qs : '') },
        })
      },

      async update(context) {
        let formData = context.formData

        let parsed: Record<string, string>
        try {
          parsed = s.parse(offeringSaveSchema, formData) as Record<string, string>
        } catch {
          return context.json(
            { ok: false, error: 'Ungültige Formulardaten.' },
            { status: 400 },
          )
        }

        let validationError = validateOfferingForm(parsed)
        if (validationError) {
          return context.json({ ok: false, error: validationError }, { status: 400 })
        }

        // Reject offerings on public holidays
        if (hd.isHoliday(new Date(parsed.day + 'T00:00:00Z'))) {
          let backState = {
            offset: parsed._offset,
            sort: parsed._sort,
            order: parsed._order,
            filter: parsed._filter,
          }
          let backParams = gridStateToParams(backState)
          let id = context.params.id
          if (id) backParams.set('editing', id)
          backParams.set('error', 'Dieses Datum ist ein Feiertag.')
          let backQs = backParams.toString()
          return new Response(null, {
            status: 302,
            headers: { Location: '/admin/offerings' + (backQs ? '?' + backQs : '') },
          })
        }

        let id = context.params.id
        if (!id) {
          return context.json(
            { ok: false, error: 'Ungültige ID.' },
            { status: 400 },
          )
        }

        let resourceId = parseInt(parsed.resource_id, 10)
        let dayMs = new Date(parsed.day + 'T00:00:00Z').getTime()
        let startMin = parseInt(parsed.start_min, 10)
        let endMin = parseInt(parsed.end_min, 10)

        // Reject past-date update
        if (isDateInPast(dayMs)) {
          let backState = {
            offset: parsed._offset,
            sort: parsed._sort,
            order: parsed._order,
            filter: parsed._filter,
          }
          let backParams = gridStateToParams(backState)
          let editingId = context.params.id
          if (editingId) backParams.set('editing', editingId)
          backParams.set('error', 'Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden.')
          let backQs = backParams.toString()
          return new Response(null, {
            status: 302,
            headers: { Location: '/admin/offerings' + (backQs ? '?' + backQs : '') },
          })
        }

        let during = `[${startMin},${endMin})`
        let now = Date.now()

        try {
          let result = await pool.query(
            `UPDATE appointoffering
             SET day = $1, resource_id = $2, during = $3, updated_at = $4
             WHERE id = $5`,
            [dayMs, resourceId, during, now, id],
          )

          if (result.rowCount === 0) {
            return context.json(
              { ok: false, error: 'Eintrag nicht gefunden.' },
              { status: 404 },
            )
          }

          let auth = context.auth
          let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'update',
              target_type: 'appointoffering',
              target_id: id,
              details: { resource_id: resourceId, day: parsed.day, during },
            })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            let backState = {
              offset: parsed._offset,
              sort: parsed._sort,
              order: parsed._order,
              filter: parsed._filter,
            }
            let backParams = gridStateToParams(backState)
            let editingId = context.params.id
            if (editingId) backParams.set('editing', editingId)
            backParams.set('error', 'Dieser Zeitraum überschneidet sich mit einem bestehenden Angebot.')
            let backQs = backParams.toString()
            return new Response(null, {
              status: 302,
              headers: { Location: '/admin/offerings' + (backQs ? '?' + backQs : '') },
            })
          }
          throw error
        }

        // Redirect back with preserved grid state
        let redirectState = {
          offset: parsed._offset,
          sort: parsed._sort,
          order: parsed._order,
          filter: parsed._filter,
        }
        let params = gridStateToParams(redirectState)
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: '/admin/offerings' + (qs ? '?' + qs : '') },
        })
      },

      async destroy(context) {
        let id = context.params.id
        if (!id) {
          return context.json(
            { ok: false, error: 'Ungültige ID.' },
            { status: 400 },
          )
        }

        let formData = context.formData

        let result = await pool.query(
          'DELETE FROM appointoffering WHERE id = $1',
          [id],
        )

        if (result.rowCount === 0) {
          return context.json(
            { ok: false, error: 'Eintrag nicht gefunden.' },
            { status: 404 },
          )
        }

        let auth = context.auth
        let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
        if (authIdentity) {
          logAdminAction(pool, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'destroy',
            target_type: 'appointoffering',
            target_id: id,
          })
        }

        // Redirect back with preserved grid state
        let redirectState = {
          offset: (formData.get('_offset') as string) ?? '',
          sort: (formData.get('_sort') as string) ?? '',
          order: (formData.get('_order') as string) ?? '',
          filter: (formData.get('_filter') as string) ?? '',
        }
        let params = gridStateToParams(redirectState)
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: '/admin/offerings' + (qs ? '?' + qs : '') },
        })
      },

      async configSave(context) {
        let formData = context.formData
        let resourceIdStr = formData.get('resource_id') as string | null

        if (!resourceIdStr) {
          return context.json(
            { ok: false, error: 'resource_id ist erforderlich.' },
            { status: 400 },
          )
        }

        let resourceId = parseInt(resourceIdStr, 10)
        if (isNaN(resourceId)) {
          return context.json(
            { ok: false, error: 'Ungültige resource_id.' },
            { status: 400 },
          )
        }

        // Build rules object from individual form fields
        let DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        let rules: Record<string, [number, number]> = {}
        for (let key of DAY_KEYS) {
          let enabled = formData.get(`${key}_enabled`)
          if (enabled === '1') {
            let startStr = formData.get(`${key}_start`) as string | null
            let endStr = formData.get(`${key}_end`) as string | null
            let start = startStr ? parseInt(startStr, 10) : NaN
            let end = endStr ? parseInt(endStr, 10) : NaN
            if (!isNaN(start) && !isNaN(end)) {
              rules[key] = [start, end]
            }
          }
        }

        await upsertConfig(pool, resourceId, rules)

        let auth = context.auth
        let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
        if (authIdentity) {
          logAdminAction(pool, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'config_save',
            target_type: 'offering_configs',
            target_id: resourceId,
            details: { rules },
          })
        }

        return new Response(null, {
          status: 302,
          headers: { Location: '/admin/offerings' },
        })
      },

      async weekGenerate(context) {
        let formData = context.formData
        let yearStr = formData.get('year') as string | null
        let weekStr = formData.get('week') as string | null

        if (!yearStr || !weekStr) {
          return context.json(
            { ok: false, error: 'year und week sind erforderlich.' },
            { status: 400 },
          )
        }

        let year = parseInt(yearStr, 10)
        let week = parseInt(weekStr, 10)

        if (isNaN(year) || isNaN(week)) {
          return context.json(
            { ok: false, error: 'Ungültige Parameter.' },
            { status: 400 },
          )
        }

        // Generate for all resources that have configs
        let configsResult = await pool.query('SELECT resource_id FROM offering_configs')
        let totalCreated = 0
        let totalSkipped = 0
        let allErrors: string[] = []

        for (let row of configsResult.rows) {
          let result = await generateWeek(pool, row.resource_id, year, week)
          totalCreated += result.created
          totalSkipped += result.skipped
          allErrors.push(...result.errors)
        }

        // Redirect back with result feedback
        let params = new URLSearchParams()
        if (allErrors.length > 0) {
          params.set('error', `${totalCreated} erstellt, ${totalSkipped} übersprungen. Fehler: ${allErrors[0]}`)
        } else {
          params.set('error', `${totalCreated} Angebote erstellt${totalSkipped > 0 ? `, ${totalSkipped} übersprungen.` : '.'}`)
        }

        let auth = context.auth
        let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
        if (authIdentity) {
          logAdminAction(pool, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'week_generate',
            target_type: 'appointoffering',
            details: { year, week, totalCreated, totalSkipped },
          })
        }

        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: '/admin/offerings' + (qs ? '?' + qs : '') },
        })
      },
    },
  },
)
