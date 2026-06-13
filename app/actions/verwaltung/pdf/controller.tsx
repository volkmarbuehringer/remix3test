import { createController } from 'remix/router'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { pool } from '../../../data/setup.ts'
import { generatePdfBuffer } from '../../../utils/pdf-utils.ts'
import { formatMinOption as formatMin } from '../../../utils/date-utils.ts'

function formatDate(date: string | number): string {
  let d = new Date(Number(date))
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

interface AppointmentRow {
  id: number
  user_name: string | null
  user_email: string
  resource_name: string | null
  resource_description: string | null
  title: string
  date: number
  start_min: number
  end_min: number
}

export default createController<typeof routes.verwaltung.pdf, AppContext>(
  routes.verwaltung.pdf,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async index(context) {
        // If loaded from a frame, redirect to full page for proper download
        if (context.request.headers.get('X-Remix-Frame') === 'true') {
          let url = new URL(context.url)
          return new Response(null, {
            status: 302,
            headers: { Location: url.href },
          })
        }

        try {
          let result = await pool.query(
            `SELECT a.id, u.name AS user_name, u.email AS user_email,
                    r.name AS resource_name, r.description AS resource_description,
                    a.title, a.date, a.start_min, a.end_min
             FROM appointments a
             LEFT JOIN users u ON u.id = a.user_id
             LEFT JOIN resources r ON r.id = a.resource_id
             ORDER BY a.date ASC, a.start_min ASC`,
          )
          let rows = result.rows as AppointmentRow[]

          let now = Date.now()

          let buffer = await generatePdfBuffer({
            pageSize: 'A4',
            pageMargins: [40, 60, 40, 60],
            content: [
              { text: 'Alle Termine', style: 'header' },
              { text: `Erstellt am ${new Date(now).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`, style: 'subheader' },
              { text: `Insgesamt ${rows.length} Termine`, style: 'subheader', margin: [0, 0, 0, 20] },
              {
                table: {
                  headerRows: 1,
                  widths: ['auto', 'auto', '*', '*', '*'],
                  body: [
                    [
                      { text: 'Datum', bold: true },
                      { text: 'Zeit', bold: true },
                      { text: 'Benutzer', bold: true },
                      { text: 'Ressource', bold: true },
                      { text: 'Titel', bold: true },
                    ],
                    ...rows.map(row => [
                      formatDate(row.date),
                      `${formatMin(row.start_min)}–${formatMin(row.end_min)}`,
                      row.user_name ?? row.user_email,
                      row.resource_name ?? row.resource_description ?? '—',
                      row.title || '—',
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

          return new Response(new Uint8Array(buffer), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="alle-termine-${new Date(now).toISOString().split('T')[0]}.pdf"`,
              'Content-Length': String(buffer.length),
            },
          })
        } catch {
          return new Response('Fehler beim Erstellen des PDFs.', { status: 500 })
        }
      },
    },
  },
)
