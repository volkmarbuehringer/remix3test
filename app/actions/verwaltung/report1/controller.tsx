import { createController } from 'remix/router'

import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../../ui/verwaltung-layout.tsx'
import { routes } from '../../../routes.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'

import { AdminReport1Page } from '../../../ui/admin-report1-page.tsx'

import type { Report1Row, Report1UserOption, RunReport1Opts } from '../../../data/report1.ts'
import {
  runReport1,
  listReport1Users,
  REPORT1_PAGE_SIZE,
  REPORT1_SORTABLE_FIELDS,
} from '../../../data/report1.ts'

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
  context: Pick<AppContext, 'db' | 'session' | 'url'>,
  overrides?: Partial<
    Pick<
      Report1PageData,
      'offset' | 'sortColumn' | 'sortDirection' | 'filter' | 'year' | 'month' | 'selectedUserId'
    >
  >,
): Promise<Report1PageData> {
  let effectivePageSize = getPageSize(context.session, REPORT1_PAGE_SIZE)
  let now = new Date()
  let year =
    overrides?.year ?? (Number(context.url.searchParams.get('year')) || now.getUTCFullYear())
  year = Math.max(2000, Math.min(2100, year))
  let month =
    overrides?.month ?? (Number(context.url.searchParams.get('month')) || now.getUTCMonth() + 1)
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
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? ('asc' as const) }
    : parseSort(context.url, {
        allowedColumns: REPORT1_SORTABLE_FIELDS,
        defaultColumn: 'name',
        defaultDirection: 'asc',
      })

  let opts: RunReport1Opts = {
    monthStart,
    monthEnd,
    selectedUserId,
    filter,
    column,
    direction,
    effectivePageSize,
    offset,
  }

  let [result, userOptions] = await Promise.all([
    runReport1(context.db, opts),
    listReport1Users(context.db),
  ])

  return {
    rows: result.rows,
    offset,
    hasMore: result.hasMore,
    prevOffset: Math.max(0, offset - effectivePageSize),
    nextOffset: offset + effectivePageSize,
    sortColumn: column,
    sortDirection: direction,
    filter,
    year,
    month,
    selectedUserId,
    users: userOptions,
  }
}

function renderReport1Page(context: { render: AppContext['render'] }, data: Report1PageData, init?: ResponseInit): Response {
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

export default createController(routes.verwaltung.report1, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let data = await loadReport1PageData(context)
      return renderReport1Page(context, data)
    },
  },
})
