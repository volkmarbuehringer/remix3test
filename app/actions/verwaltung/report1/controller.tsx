import { createController } from 'remix/router'

import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../../ui/verwaltung-layout.tsx'
import { routes } from '../../../routes.ts'
import { pool } from '../../../data/setup.ts'
import { parseSort } from '../../../utils/sort-params.ts'

import { AdminReport1Page } from '../../../ui/admin-report1-page.tsx'

// ═══════════════════════════════════════════════════════════════════
// Report 1 — Monthly appointment summary per user
// ═══════════════════════════════════════════════════════════════════

const REPORT1_PAGE_SIZE = 20

const REPORT1_SORTABLE_FIELDS = ['u.name', 'u.email', 'total_appointments', 'total_offerings', 'first_appointment', 'last_appointment', 'percentage'] as const

const REPORT1_ORDER_BY_COLUMNS: Record<string, string> = {
  name: 'u.name',
  count: 'appointment_count',
  min_date: 'min_date',
  max_date: 'max_date',
  total_hours: 'appointment_count',
  avg_hours: 'appointment_count',
}

interface Report1UserOption {
  id: string
  name: string
}

export interface Report1Row {
  user_id: string
  user_name: string
  user_email: string
  appointment_count: string
  min_date: string | null
  max_date: string | null
  total_min: string | null
  avg_min: string | null
}

interface Report1PageData {
  rows: Report1Row[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  year: number
  month: number
  selectedUserId: number | undefined
  users: Report1UserOption[]
}

async function loadReport1PageData(
  context: AppContext,
  overrides?: Partial<Pick<Report1PageData, 'offset' | 'sortColumn' | 'sortDirection' | 'filter' | 'year' | 'month' | 'selectedUserId'>>,
): Promise<Report1PageData> {
  let now = new Date()
  let year = overrides?.year ?? (Number(context.url.searchParams.get('year')) || now.getUTCFullYear())
  year = Math.max(2000, Math.min(2100, year))
  let month = overrides?.month ?? (Number(context.url.searchParams.get('month')) || (now.getUTCMonth() + 1))
  month = Math.max(1, Math.min(12, month))
  let selectedUserId = overrides?.selectedUserId
  if (selectedUserId === undefined) {
    let raw = context.url.searchParams.get('user_id')
    selectedUserId = raw ? Number(raw) || undefined : undefined
  }

  let monthStart = Date.UTC(year, month - 1, 1)
  let monthEnd = Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)

  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const }
    : parseSort(context.url, {
        allowedColumns: REPORT1_SORTABLE_FIELDS,
        defaultColumn: 'name',
        defaultDirection: 'asc',
      })

  let sortExpr = REPORT1_ORDER_BY_COLUMNS[column] || 'u.name'
  if (column === 'count') sortExpr = `COUNT(*)::int`
  if (column === 'min_date') sortExpr = `MIN(a.date)`
  if (column === 'max_date') sortExpr = `MAX(a.date)`
  if (column === 'total_hours') sortExpr = `SUM(a.end_min - a.start_min)`
  if (column === 'avg_hours') sortExpr = `SUM(a.end_min - a.start_min)::numeric / NULLIF(COUNT(*), 0)`

  let query = `SELECT u.id AS user_id, u.name AS user_name, u.email AS user_email,
                      COUNT(*)::int AS appointment_count,
                      MIN(a.date) AS min_date,
                      MAX(a.date) AS max_date,
                      SUM(a.end_min - a.start_min) AS total_min,
                      ROUND(SUM(a.end_min - a.start_min)::numeric / NULLIF(COUNT(*), 0), 1) AS avg_min
               FROM appointments a
               INNER JOIN users u ON u.id = a.user_id`

  let params: unknown[] = []
  let paramIndex = 0
  let conditions: string[] = []

  paramIndex++
  conditions.push(`a.date >= $${paramIndex}`)
  params.push(monthStart)

  paramIndex++
  conditions.push(`a.date < $${paramIndex}`)
  params.push(monthEnd)

  if (selectedUserId !== undefined) {
    paramIndex++
    conditions.push(`a.user_id = $${paramIndex}`)
    params.push(selectedUserId)
  }

  if (filter && filter.length <= 200) {
    paramIndex++
    conditions.push(`u.name ILIKE $${paramIndex}`)
    params.push(`%${filter}%`)
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`
  }

  query += ` GROUP BY u.id, u.name, u.email`

  paramIndex++
  query += ` ORDER BY ${sortExpr} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(REPORT1_PAGE_SIZE + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let [result, usersResult] = await Promise.all([
    pool.query(query, params),
    pool.query('SELECT id, name FROM users ORDER BY name ASC'),
  ])

  let rows = result.rows as Report1Row[]
  let hasMore = rows.length > REPORT1_PAGE_SIZE
  if (hasMore) rows.pop()

  let userOptions = usersResult.rows as Report1UserOption[]

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - REPORT1_PAGE_SIZE),
    nextOffset: offset + REPORT1_PAGE_SIZE,
    sortColumn: column,
    sortDirection: direction,
    filter,
    year,
    month,
    selectedUserId,
    users: userOptions,
  }
}

function renderReport1Page(context: AppContext, data: Report1PageData, init?: ResponseInit): Response {
  return renderVerwaltungPage(
    context.render,
    <AdminReport1Page
      rows={data.rows}
      offset={data.offset}
      hasMore={data.hasMore}
      prevOffset={data.prevOffset}
      nextOffset={data.nextOffset}
      sortColumn={data.sortColumn}
      sortDirection={data.sortDirection}
      filter={data.filter}
      year={data.year}
      month={data.month}
      selectedUserId={data.selectedUserId}
      users={data.users}
    />,
    init,
  )
}

export const verwaltungReport1 = createController<typeof routes.verwaltung.report1, AppContext>(
  routes.verwaltung.report1,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async index(context) {
        let data = await loadReport1PageData(context)
        return renderReport1Page(context, data)
      },
    },
  },
)
