import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../ui/verwaltung-layout.tsx'
import { VerwaltungDashboardContent } from '../../ui/verwaltung-page.tsx'

export default createController(routes.verwaltung, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    index(context) {
      return renderVerwaltungPage(context.render, <VerwaltungDashboardContent />)
    },
  },
})
