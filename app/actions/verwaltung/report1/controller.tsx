import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../../ui/verwaltung-layout.tsx'
import { routes } from '../../../routes.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'
import { monthNameDE } from '../../../utils/date-utils.ts'
import { pdfAttachmentResponse } from '../../../utils/pdf-utils.ts'
import { buildReport1Pdf } from '../../../utils/report1-pdf.ts'

import { AdminReport1Page } from '../../../ui/admin-report1-page.tsx'

import type { Report1Row, Report1UserOption, RunReport1Opts } from '../../../data/report1.ts'
import {
  runReport1,
  listReport1Users,
  REPORT1_PAGE_SIZE,
  REPORT1_SORTABLE_FIELDS,
} from '../../../data/report1.ts'

/** Row cap for the PDF export, mirroring the other verwaltung exports. */
const REPORT1_EXPORT_LIMIT = 10_000

/**
 * Marker that terminates the framed-download redirect loop. A framed request to
 * the export must be answered with HTML, never the binary, and a bare redirect
 * to the same URL loops because fetch() preserves X-Remix-Frame across
 * same-origin redirects. Mirrors the users-export shim.
 */
const FRAME_DOWNLOAD_PARAM = 'frameDownload'

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

interface Report1Query {
  year: number
  month: number
  selectedUserId: number | undefined
  filter: string | undefined
  column: string
  direction: 'asc' | 'desc'
  monthStart: number
  monthEnd: number
}

/**
 * Parse the shared report parameters (period, user, name filter, sort) once, so
 * the HTML page and the PDF export can never disagree about what they show.
 */
function parseReport1Query(
  context: Pick<AppContext, 'url'>,
  overrides?: Partial<
    Pick<
      Report1PageData,
      'sortColumn' | 'sortDirection' | 'filter' | 'year' | 'month' | 'selectedUserId'
    >
  >,
): Report1Query {
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
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? ('asc' as const) }
    : parseSort(context.url, {
        allowedColumns: REPORT1_SORTABLE_FIELDS,
        defaultColumn: 'name',
        defaultDirection: 'asc',
      })

  let monthStart = Date.UTC(year, month - 1, 1)
  let monthEnd = Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)

  return { year, month, selectedUserId, filter, column, direction, monthStart, monthEnd }
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
  let query = parseReport1Query(context, overrides)
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)

  let opts: RunReport1Opts = {
    monthStart: query.monthStart,
    monthEnd: query.monthEnd,
    selectedUserId: query.selectedUserId,
    filter: query.filter,
    column: query.column,
    direction: query.direction,
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
    sortColumn: query.column,
    sortDirection: query.direction,
    filter: query.filter,
    year: query.year,
    month: query.month,
    selectedUserId: query.selectedUserId,
    users: userOptions,
  }
}

function renderReport1Page(
  context: { render: AppContext['render'] },
  data: Report1PageData,
  init?: ResponseInit,
): Response {
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

    async pdf(context) {
      // A framed request must not receive the binary (the frame runtime would try
      // to mount it as HTML). Redirect ONCE to a marker URL whose request renders
      // HTML, terminating the chain. See
      // remix3-frame-cliententry/references/frame-navigation.md.
      if (context.request.headers.get('X-Remix-Frame') === 'true') {
        let url = new URL(context.url)
        if (url.searchParams.get(FRAME_DOWNLOAD_PARAM) === '1') {
          return renderReport1Page(context, await loadReport1PageData(context))
        }
        url.searchParams.set(FRAME_DOWNLOAD_PARAM, '1')
        return redirect(url.href)
      }

      try {
        let query = parseReport1Query(context)
        let { rows, hasMore } = await runReport1(context.db, {
          monthStart: query.monthStart,
          monthEnd: query.monthEnd,
          selectedUserId: query.selectedUserId,
          filter: query.filter,
          column: query.column,
          direction: query.direction,
          effectivePageSize: REPORT1_EXPORT_LIMIT,
          offset: 0,
        })

        let filterLabels: string[] = []
        if (query.selectedUserId !== undefined) {
          let users = await listReport1Users(context.db)
          let user = users.find((u) => Number(u.id) === query.selectedUserId)
          if (user) filterLabels.push(`Benutzer: ${user.name}`)
        }
        if (query.filter) filterLabels.push(`Name enthält: ${query.filter}`)

        let buffer = await buildReport1Pdf({
          periodLabel: `${monthNameDE(query.month)} ${query.year}`,
          filterLabel: filterLabels.length > 0 ? filterLabels.join(' · ') : undefined,
          rows,
          truncated: hasMore,
        })

        let filename = `monatsauswertung-${query.year}-${String(query.month).padStart(2, '0')}.pdf`
        return pdfAttachmentResponse(buffer, filename)
      } catch (error) {
        context.logger?.(`Fehler beim Erstellen der Monatsauswertung: ${error}`)
        return new Response('Fehler beim Erstellen des PDFs.', { status: 500 })
      }
    },
  },
})
