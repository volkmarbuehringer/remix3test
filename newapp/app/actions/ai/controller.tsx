import { createController } from 'remix/router'

import { aiRoutes as routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { renderAiPage } from '../../ui/ai-layout.tsx'
import { AiDashboardContent } from '../../ui/ai-page.tsx'

export default createController<typeof routes.ai, AppContext>(routes.ai, {
  middleware: [requireAuth()],

  actions: {
    index(context) {
      return renderAiPage(context.render, 'dashboard', <AiDashboardContent />)
    },
  },
})
