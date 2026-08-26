import { createController } from 'remix/router'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../ui/verwaltung-layout.tsx'
import { VerwaltungDashboardContent } from '../../ui/verwaltung-page.tsx'
import { countDashboardStats } from '../../data/admin-dashboard.ts'
import { routes } from '../../routes.ts'
export default createController(routes.verwaltung, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let stats = await countDashboardStats(context.db)
      return renderVerwaltungPage(context.render, <VerwaltungDashboardContent stats={stats} />)
    },
  },
})
