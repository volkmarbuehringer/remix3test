import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { AdminDashboardContent } from '../../../ui/admin-page.tsx'
import { countDashboardStats } from '../../../data/admin-dashboard.ts'
import {
  clearPageSize,
  isPageSizeKey,
  isValidPageSize,
  setPageSize,
} from '../../../utils/get-page-size.ts'
import { routes } from '../../../routes.ts'

export default createController(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let stats = await countDashboardStats(context.db)
      return renderAdminPage(context.render, 'dashboard', <AdminDashboardContent stats={stats} />)
    },

    // Shared "Einträge pro Seite" endpoint behind every admin grid, mirroring
    // routes.verwaltung.pageSize. The slider form submits the page key and the
    // grid URL to return to; a change resets paging so a stale page/offset
    // cannot land on an out-of-range page.
    async pageSize(context) {
      let session = context.session
      if (session) {
        let pageKey = context.formData.get('pageKey')
        if (typeof pageKey === 'string' && isPageSizeKey(pageKey)) {
          if (context.formData.get('_action') === 'reset-page-size') {
            clearPageSize(session, pageKey)
          } else {
            let raw = context.formData.get('pageSize')
            let next = typeof raw === 'string' ? Number(raw) : NaN
            if (isValidPageSize(next)) {
              setPageSize(session, next, pageKey)
            }
          }
        }
      }
      return redirect(adminReturnTo(context.formData))
    },
  },
})

/**
 * Resolve the grid URL to return to after saving a page size. The value is a
 * client-supplied form field, so it must resolve to a same-app path under
 * /admin; anything else falls back to the dashboard. Offset and the uploads
 * page param are dropped because changing the page size invalidates the
 * position.
 */
function adminReturnTo(formData: FormData): string {
  let fallback = routes.admin.index.href()
  let raw = formData.get('returnTo')
  if (typeof raw !== 'string' || raw.length === 0) return fallback

  let url: URL
  try {
    url = new URL(raw, 'http://internal.invalid')
  } catch {
    return fallback
  }
  if (url.origin !== 'http://internal.invalid') return fallback
  if (url.pathname !== '/admin' && !url.pathname.startsWith('/admin/')) return fallback

  url.searchParams.delete('offset')
  url.searchParams.delete('page')
  let query = url.searchParams.toString()
  return url.pathname + (query ? '?' + query : '')
}
