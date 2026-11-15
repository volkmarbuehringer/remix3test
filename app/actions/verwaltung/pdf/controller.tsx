import { createController } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { generatePdfBuffer, PDF_TRUNCATED_NOTE } from '../../../utils/pdf-utils.ts'
import { listAllAppointments } from '../../../data/pdf.ts'
import { formatMinOption as formatMin } from '../../../utils/date-utils.ts'

function formatDate(date: string | number): string {
  let d = new Date(Number(date))
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const FRAME_DOWNLOAD_PARAM = 'frameDownload'

export default createController(routes.verwaltung.pdf, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      // Native downloads use data-rmx-document. A framed direct hit must not
      // redirect to this same URL unconditionally: the frame client re-sends
      // X-Remix-Frame across the redirect and loops until the fetch aborts.
      // Mark once, then render the Verwaltung page so the chain terminates.
      if (context.request.headers.get('X-Remix-Frame') === 'true') {
        let url = new URL(context.url)
        if (url.searchParams.get(FRAME_DOWNLOAD_PARAM) === '1') {
          return redirect(routes.verwaltung.index.href(), 303)
        }
        url.searchParams.set(FRAME_DOWNLOAD_PARAM, '1')
        return redirect(url.href, 303)
      }

      try {
        let { rows, truncated } = await listAllAppointments(context.db)

        let now = Date.now()

        let buffer = await generatePdfBuffer({
          pageSize: 'A4',
          pageMargins: [40, 60, 40, 60],
          content: [
            { text: 'Alle Termine', style: 'header' },
            {
              text: `Erstellt am ${new Date(now).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`,
              style: 'subheader',
            },
            {
              text: `Insgesamt ${rows.length} Termine${truncated ? PDF_TRUNCATED_NOTE : ''}`,
              style: 'subheader',
              margin: [0, 0, 0, 20],
            },
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
                  ...rows.map((row) => [
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

        let pdfHeaders = new SuperHeaders()
        pdfHeaders.contentType = 'application/pdf'
        pdfHeaders.contentDisposition = {
          type: 'attachment',
          filename: `alle-termine-${new Date(now).toISOString().split('T')[0]}.pdf`,
        }
        pdfHeaders.contentLength = buffer.length
        pdfHeaders.set('X-Content-Type-Options', 'nosniff')
        return new Response(new Uint8Array(buffer), { headers: pdfHeaders })
      } catch {
        return new Response('Fehler beim Erstellen des PDFs.', { status: 500 })
      }
    },
  },
})
