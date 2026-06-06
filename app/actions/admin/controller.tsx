import { createController } from 'remix/router'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { routes } from '../../routes.ts'
import { renderAdminPage } from '../../ui/admin-layout.tsx'
import { AdminDashboardContent } from '../../ui/admin-page.tsx'

export default createController(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    index(context) {
      return renderAdminPage(context.render, 'dashboard', <AdminDashboardContent />)
    },
  },
})
