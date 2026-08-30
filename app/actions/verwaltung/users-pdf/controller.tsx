import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { listUserSummaries } from '../../../data/users-pdf.ts'
import { pdfAttachmentResponse } from '../../../utils/pdf-utils.ts'
import { buildUserSummaryPdf } from '../../../utils/user-summary-pdf.ts'

export default createController(routes.verwaltung.usersPdf, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      if (context.request.headers.get('X-Remix-Frame') === 'true') {
        let url = new URL(context.url)
        return redirect(url.href)
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
