import { createController } from 'remix/router'

import { assetServer } from '../../assets.ts'
import { routes } from '../../routes.ts'
import { Document } from '../../ui/document.tsx'
import { Layout } from '../../ui/layout.tsx'
import { HomePage } from '../../ui/scaffold-home-page.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      )
    },
    home(context) {
      return context.render(
        <Document>
          <HomePage />
        </Document>,
      )
    },
  },
})
