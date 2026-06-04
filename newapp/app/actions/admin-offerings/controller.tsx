import { createController } from 'remix/router'
import * as s from 'remix/data-schema'

import { verwaltungRoutes as routes } from '../../routes.ts'
import { pool } from '../../data/setup.ts'
import type { AppContext } from '../../types/context.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../ui/verwaltung-layout.tsx'
import { AdminOfferingsPage } from '../../ui/admin-offerings-page.tsx'
import { parseSort } from '../../utils/sort-params.ts'
import { gridStateToParams, gridStateFromFormData, gridStateOffset, gridStateSort, gridStateDirection, gridStateFilter, type GridState } from '../../utils/grid-state.ts'
import { isDateInPast } from '../../utils/date-utils.ts'
import { getConfig, upsertConfig, generateWeek } from '../../data/offering-configs.ts'
import type { OfferingConfig } from '../../data/offering-configs.ts'
import Holidays from 'date-holidays'
import { logAdminAction } from '../../data/audit-log.ts'
import { isConstraintViolation } from '../../utils/db-errors.ts'
import { getAdminIdentity } from '../../utils/context.ts'

import { offeringSaveSchema, OFFERING_FORM_KEYS } from '../../utils/offering-schema.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../utils/schema-utils.ts'

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

export interface OfferingPageData {
  rows: OfferingRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow: OfferingRow | null
  creating: boolean
  resources: ResourceOption[]
  error: string | undefined
  configResourceId: number | undefined
  offeringConfig: OfferingConfig | undefined
  addWeek: boolean
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

// ── Form schema ──────────────────────────────────────────────────
// (offeringSaveSchema imported from ../utils/offering-schema.ts)

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
      err.constraint === 'no_overlapping_seats' ||
      err.code === '23P01' ||
      (err.message ?? '').includes('conflicts with key')
    )
  }
  return false
}

// ── Shared helpers ───────────────────────────────────────────────

async function fetchOfferingEditRow(id: string): Promise<OfferingRow | null> {
  let result = await pool.query(
    `SELECT ao.id, ao.day, ao.resource_id, r.description AS resource_description,
            ao.during, ao.created_at, ao.updated_at
     FROM appointoffering ao
     LEFT JOIN resources r ON r.id = ao.resource_id
     WHERE ao.id = $1`,
    [id],
  )
  return result.rows.length > 0 ? (result.rows[0] as OfferingRow) : null
}

// ── Page data loader ─────────────────────────────────────────────

async function loadOfferingPageData(
  context: AppContext,
  overrides?: Partial<Pick<OfferingPageData, 'creating' | 'editRow' | 'error' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter'>>,
): Promise<OfferingPageData> {
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const }
    : parseSort(context.url, {
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

  let queryParams: unknown[] = []
  let paramIndex = 0

  if (filter && filter.length <= 200) {
    paramIndex++
    let searchPattern = `%${filter}%`
    let conditions = SEARCH_COLUMNS.map(
      (col) => `${col} ILIKE $${paramIndex}`,
    )
    query += ` WHERE (${conditions.join(' OR ')})`
    queryParams.push(searchPattern)
  }

  paramIndex++
  query += ` ORDER BY ${ORDER_BY_COLUMNS[column] || 'ao.day'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  queryParams.push(PAGE_SIZE + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  queryParams.push(offset)

  let result = await pool.query(query, queryParams)
  let rows = result.rows as OfferingRow[]
  let hasMore = rows.length > PAGE_SIZE
  if (hasMore) rows.pop()

  let resourcesResult = await pool.query(
    'SELECT id, description FROM resources ORDER BY description ASC',
  )
  let resources = resourcesResult.rows as ResourceOption[]

  // Edit row
  let editingParam = overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = editingParam || null
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId) {
    editRow = await fetchOfferingEditRow(editingRowId)
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  let error = (overrides?.error ?? context.url.searchParams.get('error')) || undefined
  let formValues = overrides?.formValues ?? undefined
  let fieldErrors = overrides?.fieldErrors ?? undefined
  let formError = overrides?.formError ?? undefined

  let configResourceId = context.url.searchParams.get('config')
  let addWeek = context.url.searchParams.get('addweek') === 'true'

  let offeringConfig: OfferingConfig | null = null
  if (configResourceId) {
    let rid = parseInt(configResourceId, 10)
    if (!isNaN(rid)) {
      offeringConfig = await getConfig(context.db, rid)
    }
  }

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - PAGE_SIZE),
    nextOffset: offset + PAGE_SIZE,
    sortColumn: column,
    sortDirection: direction,
    filter,
    editRow,
    creating,
    resources,
    error,
    configResourceId: configResourceId ? parseInt(configResourceId, 10) : undefined,
    offeringConfig: offeringConfig ?? undefined,
    addWeek,
    formValues,
    fieldErrors,
    formError,
  }
}

// ── Render helper ────────────────────────────────────────────────

function renderOfferingsPage(context: AppContext, data: OfferingPageData, init?: ResponseInit): Response {
  return renderVerwaltungPage(
    context.render,
    <AdminOfferingsPage
      rows={data.rows}
      offset={data.offset}
      hasMore={data.hasMore}
      prevOffset={data.prevOffset}
      nextOffset={data.nextOffset}
      sortColumn={data.sortColumn}
      sortDirection={data.sortDirection}
      filter={data.filter}
      editRow={data.editRow}
      creating={data.creating}
      resources={data.resources}
      error={data.error}
      configResourceId={data.configResourceId}
      offeringConfig={data.offeringConfig}
      addWeek={data.addWeek}
      formValues={data.formValues}
      fieldErrors={data.fieldErrors}
      formError={data.formError}
    />,
    init,
  )
}

// ── Controller ───────────────────────────────────────────────────

export default createController<typeof routes.verwaltung.offerings, AppContext>(
  routes.verwaltung.offerings,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async index(context) {
        let data = await loadOfferingPageData(context)
        return renderOfferingsPage(context, data)
      },

      async create(context) {
        let formData = context.formData
        let formValues = readFormFieldValues(OFFERING_FORM_KEYS, formData)
        let gridValues = gridStateFromFormData(formData)

        let result = s.parseSafe(offeringSaveSchema, formData)

        if (!result.success) {
          let fieldErrors = issuesToFieldErrors(result.issues)
          let data = await loadOfferingPageData(context, {
            creating: true,
            formValues,
            fieldErrors,
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let { resource_id, day, start_min, end_min } = result.value

        // Cross-field validation
        if (end_min <= start_min) {
          let data = await loadOfferingPageData(context, {
            creating: true,
            formValues,
            fieldErrors: { end_min: 'muss nach der Startzeit liegen.' },
            formError: 'muss nach der Startzeit liegen.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        // Reject offerings on public holidays
        if (hd.isHoliday(new Date(day + 'T00:00:00Z'))) {
          let data = await loadOfferingPageData(context, {
            creating: true,
            formValues,
            formError: 'Dieses Datum ist ein Feiertag.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let dayMs = new Date(day + 'T00:00:00Z').getTime()

        // Reject past-date creation
        if (isDateInPast(dayMs)) {
          let data = await loadOfferingPageData(context, {
            creating: true,
            formValues,
            formError: 'Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let during = `[${start_min},${end_min})`
        let now = Date.now()
        let newId: number

        try {
          let insertResult = await pool.query(
            `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [dayMs, resource_id, during, now, now],
          )
          newId = insertResult.rows[0].id

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'create',
              target_type: 'appointoffering',
              target_id: newId,
              details: { resource_id, day, during },
            })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            let data = await loadOfferingPageData(context, {
              creating: true,
              formValues,
              formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Angebot.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
            })
            return renderOfferingsPage(context, data, { status: 400 })
          }
          throw error
        }

        // Redirect back with preserved grid state, showing the new record in edit mode
        let params = gridStateToParams(gridValues)
        params.set('editing', String(newId))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
        })
      },

      async update(context) {
        let formData = context.formData
        let id = context.params.id
        if (!id) {
          return context.json(
            { ok: false, error: 'Ungültige ID.' },
            { status: 400 },
          )
        }

        let formValues = readFormFieldValues(OFFERING_FORM_KEYS, formData)
        let gridValues = gridStateFromFormData(formData)

        let result = s.parseSafe(offeringSaveSchema, formData)

        if (!result.success) {
          let fieldErrors = issuesToFieldErrors(result.issues)
          let editRow = await fetchOfferingEditRow(id)
          let data = await loadOfferingPageData(context, {
            editRow,
            formValues,
            fieldErrors,
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let { resource_id, day, start_min, end_min } = result.value

        // Cross-field validation
        if (end_min <= start_min) {
          let editRow = await fetchOfferingEditRow(id)
          let data = await loadOfferingPageData(context, {
            editRow,
            formValues,
            fieldErrors: { end_min: 'muss nach der Startzeit liegen.' },
            formError: 'muss nach der Startzeit liegen.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        // Reject offerings on public holidays
        if (hd.isHoliday(new Date(day + 'T00:00:00Z'))) {
          let editRow = await fetchOfferingEditRow(id)
          let data = await loadOfferingPageData(context, {
            editRow,
            formValues,
            formError: 'Dieses Datum ist ein Feiertag.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let dayMs = new Date(day + 'T00:00:00Z').getTime()

        // Reject past-date update
        if (isDateInPast(dayMs)) {
          let editRow = await fetchOfferingEditRow(id)
          let data = await loadOfferingPageData(context, {
            editRow,
            formValues,
            formError: 'Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let during = `[${start_min},${end_min})`
        let now = Date.now()

        try {
          let updateResult = await pool.query(
            `UPDATE appointoffering
             SET day = $1, resource_id = $2, during = $3, updated_at = $4
             WHERE id = $5`,
            [dayMs, resource_id, during, now, id],
          )

          if (updateResult.rowCount === 0) {
            return context.json(
              { ok: false, error: 'Eintrag nicht gefunden.' },
              { status: 404 },
            )
          }

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'update',
              target_type: 'appointoffering',
              target_id: id,
              details: { resource_id, day, during },
            })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            let editRow = await fetchOfferingEditRow(id)
            let data = await loadOfferingPageData(context, {
              editRow,
              formValues,
              formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Angebot.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
            })
            return renderOfferingsPage(context, data, { status: 400 })
          }
          throw error
        }

        // Redirect back with preserved grid state
        let params = gridStateToParams(gridValues)
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
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

        try {
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

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'destroy',
              target_type: 'appointoffering',
              target_id: id,
            })
          }
        } catch (error: unknown) {
          if (isConstraintViolation(error)) {
            let params = gridStateToParams(gridStateFromFormData(formData))
            let qs = params.toString()
            return new Response(null, {
              status: 302,
              headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
            })
          }
          throw error
        }

        let params = gridStateToParams(gridStateFromFormData(formData))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
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

        let authIdentity = getAdminIdentity(context.auth)
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
          headers: { Location: routes.verwaltung.offerings.index.href() },
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

        let authIdentity = getAdminIdentity(context.auth)
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
          headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
        })
      },
    },
  },
)
