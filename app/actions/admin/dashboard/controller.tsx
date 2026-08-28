import { createController } from 'remix/router'

import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { AdminDashboardContent } from '../../../ui/admin-page.tsx'
import { countDashboardStats } from '../../../data/admin-dashboard.ts'
import { routes } from '../../../routes.ts'

export default createController(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let stats = await countDashboardStats(context.db)
      return renderAdminPage(context.render, 'dashboard', <AdminDashboardContent stats={stats} />)
    },
  },
})
