import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { renderAiPage } from '../../ui/ai-layout.tsx'
import { AiDashboardContent } from '../../ui/ai-page.tsx'

export default createController(routes.ai, {
  middleware: [requireAuth()],

  actions: {
    index(context) {
      return renderAiPage(context.render, 'dashboard', <AiDashboardContent />)
    },
  },
})
