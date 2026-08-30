import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { listUserSummariesByDateRange } from '../../../data/users-export.ts'
import { renderVerwaltungPage } from '../../../ui/verwaltung-layout.tsx'
import { UsersExportPage } from '../../../ui/users-export-page.tsx'
import { pdfAttachmentResponse } from '../../../utils/pdf-utils.ts'
import { buildUserSummaryPdf } from '../../../utils/user-summary-pdf.ts'
import { issuesToFieldErrors } from '../../../utils/schema-utils.ts'
import {
  MS_PER_DAY,
  formatUtcPeriodDayDE,
  parseIsoDateUtc,
} from '../../../utils/date-utils.ts'

function isIsoCalendarDate(value: string): boolean {
  return parseIsoDateUtc(value) !== null
}

const exportRangeSchema = s.object({
  startDate: s
    .string()
    .refine(isIsoCalendarDate, 'G\u00fcltiges Startdatum erforderlich (YYYY-MM-DD).'),
  endDate: s
    .string()
    .refine(isIsoCalendarDate, 'G\u00fcltiges Enddatum erforderlich (YYYY-MM-DD).'),
})

const FRAME_DOWNLOAD_PARAM = 'frameDownload'

/**
 * Validate the submitted range and produce either the PDF download, a 400
 * re-render with per-field errors, or a 200 empty-state notice. Shared by
 * the GET index download and the POST create action (design D3).
 */
async function downloadUsersExport(
  context: any,
  startDate: string,
  endDate: string,
): Promise<Response> {
  let result = s.parseSafe(exportRangeSchema, { startDate, endDate })

  if (!result.success) {
    return renderVerwaltungPage(
      context.render,
      <UsersExportPage
        fieldErrors={issuesToFieldErrors(result.issues)}
        startDate={startDate}
        endDate={endDate}
      />,
      { status: 400 },
    )
  }

  let startMs = parseIsoDateUtc(result.value.startDate)
  let endMs = parseIsoDateUtc(result.value.endDate)
  if (startMs === null || endMs === null || endMs + MS_PER_DAY <= startMs) {
    return renderVerwaltungPage(
      context.render,
      <UsersExportPage
        fieldErrors={{ endDate: 'Das Enddatum muss nach dem Startdatum liegen.' }}
        startDate={startDate}
        endDate={endDate}
      />,
      { status: 400 },
    )
  }
  let endMsExclusive = endMs + MS_PER_DAY

  try {
    let { rows, truncated } = await listUserSummariesByDateRange(
      context.db,
      startMs,
      endMsExclusive,
    )

    if (rows.length === 0) {
      return renderVerwaltungPage(
        context.render,
        <UsersExportPage
          notice="Keine Benutzer mit Terminen im gew\u00e4hlten Zeitraum gefunden."
          startDate={result.value.startDate}
          endDate={result.value.endDate}
        />,
        { status: 200 },
      )
    }

    let buffer = await buildUserSummaryPdf({
      title: 'Benutzer-Export',
      periodLabel: `Zeitraum: ${formatUtcPeriodDayDE(startMs)} \u2013 ${formatUtcPeriodDayDE(endMs)}`,
      countLabel: `Insgesamt ${rows.length} Benutzer mit Terminen`,
      rows,
      truncated,
    })

    return pdfAttachmentResponse(
      buffer,
      `benutzer-export-${result.value.startDate}_${result.value.endDate}.pdf`,
    )
  } catch (error) {
    context.logger?.(`Fehler beim Erstellen des Benutzer-Export-PDFs: ${error}`)
    return new Response('Fehler beim Erstellen des PDFs.', { status: 500 })
  }
}

export default createController(routes.verwaltung.usersExport, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let url = new URL(context.url)
      let startDate = url.searchParams.get('startDate')
      let endDate = url.searchParams.get('endDate')

      if (startDate && endDate) {
        if (context.request.headers.get('X-Remix-Frame') === 'true') {
          // The frame client re-sends X-Remix-Frame when fetch follows a
          // redirect, so a bare 302 to the same URL loops until the browser
          // aborts the fetch (NetworkError). Redirect once to a marker URL:
          // the marked request renders HTML, which terminates the chain. The
          // frame client then bails to a full-page navigation of the marked
          // URL, which downloads the PDF without frame headers (design D6).
          if (url.searchParams.get(FRAME_DOWNLOAD_PARAM) === '1') {
            return renderVerwaltungPage(
              context.render,
              <UsersExportPage startDate={startDate} endDate={endDate} />,
            )
          }
          url.searchParams.set(FRAME_DOWNLOAD_PARAM, '1')
          return redirect(url.href)
        }
        return downloadUsersExport(context, startDate, endDate)
      }

      return renderVerwaltungPage(context.render, <UsersExportPage />)
    },

    async create(context) {
      let formData = context.formData
      let startDate = (formData.get('startDate') as string) ?? ''
      let endDate = (formData.get('endDate') as string) ?? ''

      if (context.request.headers.get('X-Remix-Frame') === 'true') {
        let url = new URL(context.url)
        let params = new URLSearchParams()
        if (startDate) params.set('startDate', startDate)
        if (endDate) params.set('endDate', endDate)
        params.set(FRAME_DOWNLOAD_PARAM, '1')
        return redirect(`${url.pathname}?${params}`)
      }

      return downloadUsersExport(context, startDate, endDate)
    },
  },
})
