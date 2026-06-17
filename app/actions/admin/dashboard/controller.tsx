import { createController } from 'remix/router'

import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { AdminDashboardContent } from '../../../ui/admin-page.tsx'
import { routes } from '../../../routes.ts'

export default createController<typeof routes.admin, AppContext>(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    index(context) {
      return renderAdminPage(context.render, 'dashboard', <AdminDashboardContent />)
    },
  },
})
