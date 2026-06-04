import { createController } from 'remix/router'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { adminRoutes as routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { renderAdminPage } from '../../ui/admin-layout.tsx'
import { AdminDashboardContent } from '../../ui/admin-page.tsx'

export default createController<typeof routes.admin, AppContext>(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    index(context) {
      return renderAdminPage(context.render, 'dashboard', <AdminDashboardContent />)
    },
  },
})
