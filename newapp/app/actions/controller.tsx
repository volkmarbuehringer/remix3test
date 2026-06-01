import { createController } from 'remix/router'

import { assetServer } from '../assets.ts'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { Layout } from '../ui/layout.tsx'
import { HomePage } from '../ui/scaffold-home-page.tsx'
import { ShowcaseIndexPage } from '../ui/showcase-pages.tsx'
import { SHOWCASE_PAGES, type ShowcasePageId } from '../ui/showcase-registry.ts'
import type { AppContext } from '../types/context.ts'

export default createController<typeof routes, AppContext>(routes, {
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
    ui(context) {
      return context.render(
        <Layout>
          <ShowcaseIndexPage />
        </Layout>,
      )
    },
    uiComponent(context) {
      let page = SHOWCASE_PAGES[context.params.component as ShowcasePageId]
      if (!page) return new Response('Not Found', { status: 404 })
      return context.render(
        <Layout>
          <page.render />
        </Layout>,
      )
    },
  },
})
