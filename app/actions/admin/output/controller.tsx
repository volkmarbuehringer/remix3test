import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { USERS_EXPORT_LIMIT, loadUsersPage, parseUsersQuery } from '../../../data/admin-users.ts'
import { buildAdminUsersPdf } from '../../../utils/admin-users-pdf.ts'
import { formatIsoDateUtc } from '../../../utils/date-utils.ts'
import { pdfAttachmentResponse } from '../../../utils/pdf-utils.ts'
import { renderUsersIndex } from '../users/controller.tsx'

/**
 * Marker that terminates the framed-download redirect loop. A framed request
 * must be answered with HTML, never the binary, and a bare redirect to the same
 * URL loops because fetch() preserves X-Remix-Frame across same-origin
 * redirects. Mirrors the report1/users-export shims.
 */
const FRAME_DOWNLOAD_PARAM = 'frameDownload'

/**
 * PDF output for the admin users grid. Renders every row matching the grid's
 * current search/status filter in its current sort order (not just the visible
 * page), so the file matches the view described in its "Ansicht" line.
 */
export default createController(routes.admin.output, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      if (context.request.headers.get('X-Remix-Frame') === 'true') {
        let url = new URL(context.url)
        if (url.searchParams.get(FRAME_DOWNLOAD_PARAM) === '1') {
          // The marker request is followed in-frame, so it must render the real
          // users page; a minimal placeholder would replace the grid.
          return renderUsersIndex(context)
        }
        url.searchParams.set(FRAME_DOWNLOAD_PARAM, '1')
        return redirect(url.href)
      }

      try {
        let query = parseUsersQuery(context.url)
        let { rows, total, hasMore } = await loadUsersPage(context.db, {
          offset: 0,
          column: query.column,
          direction: query.direction,
          filter: query.filter,
          status: query.status,
          pageSize: USERS_EXPORT_LIMIT,
        })

        let buffer = await buildAdminUsersPdf({
          rows,
          total,
          truncated: hasMore,
          filter: query.filter,
          status: query.status,
          sortColumn: query.column,
          sortDirection: query.direction,
        })

        return pdfAttachmentResponse(buffer, `benutzer-${formatIsoDateUtc()}.pdf`)
      } catch (error) {
        context.logger?.(`Fehler beim Erstellen des Benutzer-PDFs: ${error}`)
        return new Response('Fehler beim Erstellen des PDFs.', { status: 500 })
      }
    },
  },
})
