import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { listUserSummaries } from '../../../data/users-pdf.ts'
import { pdfAttachmentResponse } from '../../../utils/pdf-utils.ts'
import { buildUserSummaryPdf } from '../../../utils/user-summary-pdf.ts'

const FRAME_DOWNLOAD_PARAM = 'frameDownload'

export default createController(routes.verwaltung.usersPdf, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      // Native downloads use data-rmx-document. A framed direct hit must not
      // redirect to this same URL unconditionally: the frame client re-sends
      // X-Remix-Frame across the redirect and loops until the fetch aborts.
      // Mark once, then send the frame to the export page (HTML) to terminate.
      if (context.request.headers.get('X-Remix-Frame') === 'true') {
        let url = new URL(context.url)
        if (url.searchParams.get(FRAME_DOWNLOAD_PARAM) === '1') {
          return redirect(routes.verwaltung.usersExport.index.href(), 303)
        }
        url.searchParams.set(FRAME_DOWNLOAD_PARAM, '1')
        return redirect(url.href, 303)
      }

      try {
        let { rows, truncated } = await listUserSummaries(context.db)

        let buffer = await buildUserSummaryPdf({
          title: 'Benutzerübersicht',
          periodLabel: `Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`,
          countLabel: `Insgesamt ${rows.length} Benutzer`,
          rows,
          truncated,
        })

        let filename = `benutzeruebersicht-${new Date().toISOString().split('T')[0]}.pdf`
        return pdfAttachmentResponse(buffer, filename)
      } catch (error) {
        context.logger?.(`Fehler beim Erstellen des Benutzer-PDFs: ${error}`)
        return new Response('Fehler beim Erstellen des PDFs.', { status: 500 })
      }
    },
  },
})
