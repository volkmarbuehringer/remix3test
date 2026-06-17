import { createController } from 'remix/router'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../ui/verwaltung-layout.tsx'
import { VerwaltungDashboardContent } from '../../ui/verwaltung-page.tsx'
import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'

export default createController<typeof routes.verwaltung, AppContext>(routes.verwaltung, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    index(context) {
      return renderVerwaltungPage(context.render, <VerwaltungDashboardContent />)
    },
  },
})
