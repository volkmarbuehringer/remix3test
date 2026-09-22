import { createController } from 'remix/router'

import { legal } from '../../routes.ts'
import { DatenschutzPage, ImpressumPage } from '../../ui/legal-pages.tsx'

export default createController(legal, {
  actions: {
    impressum(context) {
      return context.render(<ImpressumPage />)
    },
    datenschutz(context) {
      return context.render(<DatenschutzPage />)
    },
  },
})
