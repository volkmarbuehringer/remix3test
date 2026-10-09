import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../ui/verwaltung-layout.tsx'
import { VerwaltungDashboardContent } from '../../ui/verwaltung-page.tsx'
import { countDashboardStats } from '../../data/admin-dashboard.ts'
import {
  clearPageSize,
  isPageSizeKey,
  isValidPageSize,
  setPageSize,
} from '../../utils/get-page-size.ts'
import { routes } from '../../routes.ts'
export default createController(routes.verwaltung, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let stats = await countDashboardStats(context.db)
      return renderVerwaltungPage(context.render, <VerwaltungDashboardContent stats={stats} />, {
        title: 'Übersicht – Verwaltung',
      })
    },

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
      return redirect(verwaltungReturnTo(context.formData))
    },
  },
})

/**
 * Resolve the grid URL to return to after saving a page size. The value is a
 * client-supplied form field, so it must resolve to a same-app path under
 * /verwaltung; anything else falls back to the dashboard. `offset` is dropped
 * because changing the page size invalidates the current page position.
 */
function verwaltungReturnTo(formData: FormData): string {
  let fallback = routes.verwaltung.index.href()
  let raw = formData.get('returnTo')
  if (typeof raw !== 'string' || raw.length === 0) return fallback

  let url: URL
  try {
    url = new URL(raw, 'http://internal.invalid')
  } catch {
    return fallback
  }
  if (url.origin !== 'http://internal.invalid') return fallback
  if (url.pathname !== '/verwaltung' && !url.pathname.startsWith('/verwaltung/')) return fallback

  url.searchParams.delete('offset')
  let query = url.searchParams.toString()
  return url.pathname + (query ? '?' + query : '')
}
