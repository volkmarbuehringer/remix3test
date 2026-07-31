import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { SuperHeaders } from 'remix/headers'

import { routes } from '../../../routes.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { generatePdfBuffer } from '../../../utils/pdf-utils.ts'
import { listUserSummariesByDateRange } from '../../../data/users-export.ts'
import { formatMinOption as formatMin } from '../../../utils/date-utils.ts'
import { renderVerwaltungPage } from '../../../ui/verwaltung-layout.tsx'
import { UsersExportPage } from '../../../ui/users-export-page.tsx'

function formatDate(date: string | number | null): string {
  if (date === null) return '\u2014'
  let d = new Date(Number(date))
  if (isNaN(d.getTime())) return '\u2014'
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function toLocalDateString(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

interface UserSummaryRow {
  user_id: number
  name: string
  email: string
  appointment_count: number
  total_minutes: number
  first_date: number | null
  last_date: number | null
}

export default createController(routes.verwaltung.usersExport, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      return renderVerwaltungPage(context.render, <UsersExportPage />)
    },

    async create(context) {
      let formData = context.formData

      let result = s.parseSafe(
        f.object({
          startDate: f.field(
            s
              .string()
              .refine(
                (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
                'Gültiges Startdatum erforderlich (YYYY-MM-DD).',
              ),
          ),
          endDate: f.field(
            s
              .string()
              .refine(
                (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
                'Gültiges Enddatum erforderlich (YYYY-MM-DD).',
              ),
          ),
        }),
        formData,
      )

      if (!result.success) {
        return renderVerwaltungPage(
          context.render,
          <UsersExportPage
            error={result.issues[0]?.message ?? 'Ungültige Anfrage.'}
            startDate={(formData.get('startDate') as string) ?? undefined}
            endDate={(formData.get('endDate') as string) ?? undefined}
          />,
          { status: 400 },
        )
      }

      let { startDate, endDate } = result.value
      let startMs = new Date(startDate + 'T00:00:00Z').getTime()
      let endMs = new Date(endDate + 'T00:00:00Z').getTime() + 86_400_000

      if (endMs <= startMs) {
        return renderVerwaltungPage(
          context.render,
          <UsersExportPage
            error="Das Enddatum muss nach dem Startdatum liegen."
            startDate={startDate}
            endDate={endDate}
          />,
          { status: 400 },
        )
      }

      try {
        let rows = await listUserSummariesByDateRange(context.db, startMs, endMs)

        if (rows.length === 0) {
          return renderVerwaltungPage(
            context.render,
            <UsersExportPage
              error="Keine Benutzer mit Terminen im gewählten Zeitraum gefunden."
              startDate={startDate}
              endDate={endDate}
            />,
            { status: 404 },
          )
        }

        let buffer = await generatePdfBuffer({
          pageSize: 'A4',
          pageMargins: [40, 60, 40, 60],
          content: [
            { text: 'Benutzer-Export', style: 'header' },
            {
              text: `Zeitraum: ${toLocalDateString(startDate)} \u2013 ${toLocalDateString(endDate)}`,
              style: 'subheader',
            },
            {
              text: `Insgesamt ${rows.length} Benutzer mit Terminen`,
              style: 'subheader',
              margin: [0, 0, 0, 20],
            },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  [
                    { text: 'Name', bold: true },
                    { text: 'E-Mail', bold: true },
                    { text: 'Termine', bold: true },
                    { text: 'Gesamtzeit', bold: true },
                    { text: 'Erster Termin', bold: true },
                    { text: 'Letzter Termin', bold: true },
                  ],
                  ...rows.map((row) => [
                    row.name ?? row.email,
                    row.email,
                    String(row.appointment_count),
                    row.appointment_count > 0 ? formatMin(row.total_minutes) : '\u2014',
                    formatDate(row.first_date),
                    formatDate(row.last_date),
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
          styles: {
            header: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
            subheader: { fontSize: 11, color: '#666666', margin: [0, 0, 0, 4] },
          },
        })

        let filename = `benutzer-export-${startDate}_${endDate}.pdf`

        let pdfHeaders = new SuperHeaders()
        pdfHeaders.contentType = 'application/pdf'
        pdfHeaders.contentDisposition = { type: 'attachment', filename }
        pdfHeaders.contentLength = buffer.length
        return new Response(new Uint8Array(buffer), { headers: pdfHeaders })
      } catch {
        return new Response('Fehler beim Erstellen des PDFs.', { status: 500 })
      }
    },
  },
})
