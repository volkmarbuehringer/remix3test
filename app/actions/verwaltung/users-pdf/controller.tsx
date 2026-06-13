import { createController } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { pool } from '../../../data/setup.ts'
import { generatePdfBuffer } from '../../../utils/pdf-utils.ts'
import { formatMinOption as formatMin } from '../../../utils/date-utils.ts'

function formatDate(date: string | number | null): string {
  if (date === null) return '—'
  let d = new Date(Number(date))
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
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

export default createController<typeof routes.verwaltung.usersPdf, AppContext>(
  routes.verwaltung.usersPdf,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async index(context) {
        if (context.request.headers.get('X-Remix-Frame') === 'true') {
          let url = new URL(context.url)
          return redirect(url.href)
        }

        try {
          let result = await pool.query(
            `SELECT u.id AS user_id, u.name, u.email,
                    COUNT(a.id)::int AS appointment_count,
                    COALESCE(SUM(a.end_min - a.start_min), 0)::int AS total_minutes,
                    MIN(a.date) AS first_date,
                    MAX(a.date) AS last_date
             FROM users u
             LEFT JOIN appointments a ON a.user_id = u.id
             GROUP BY u.id, u.name, u.email
             ORDER BY u.name ASC`,
          )
          let rows = result.rows as UserSummaryRow[]

          let now = Date.now()

          let buffer = await generatePdfBuffer({
            pageSize: 'A4',
            pageMargins: [40, 60, 40, 60],
            content: [
              { text: 'Benutzerübersicht', style: 'header' },
              { text: `Erstellt am ${new Date(now).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`, style: 'subheader' },
              { text: `Insgesamt ${rows.length} Benutzer`, style: 'subheader', margin: [0, 0, 0, 20] },
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
                    ...rows.map(row => [
                      row.name ?? row.email,
                      row.email,
                      String(row.appointment_count),
                      row.appointment_count > 0 ? formatMin(row.total_minutes) : '—',
                      formatDate(row.first_date),
                      formatDate(row.last_date),
                    ]),
                  ],
                },
                layout: 'lightHorizontalLines',
              },
            ],
            styles: {
              header: {
                fontSize: 18,
                bold: true,
                margin: [0, 0, 0, 8],
              },
              subheader: {
                fontSize: 11,
                color: '#666666',
                margin: [0, 0, 0, 4],
              },
            },
          })

          let pdfHeaders = new SuperHeaders()
          pdfHeaders.contentType = 'application/pdf'
          pdfHeaders.contentDisposition = { type: 'attachment', filename: `benutzeruebersicht-${new Date(now).toISOString().split('T')[0]}.pdf` }
          pdfHeaders.contentLength = buffer.length
          return new Response(new Uint8Array(buffer), { headers: pdfHeaders })
        } catch {
          return new Response('Fehler beim Erstellen des PDFs.', { status: 500 })
        }
      },
    },
  },
)
