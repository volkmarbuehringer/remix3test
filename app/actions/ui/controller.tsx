import { fileURLToPath } from 'node:url'

import type { EntryComponent } from 'remix/component'
import { clientEntry } from 'remix/component'
import { openLazyFile } from 'remix/fs'
import { createFileResponse } from 'remix/response/file'
import { createController } from 'remix/router'

import { assetServer } from '../../assets.ts'
import { isExplicitDevelopmentEnv, isExplicitTestEnv } from '../../config.ts'
import { routes } from '../../routes.ts'
import { discoverDemoFiles, findDemoFile, loadDemoModule } from './discovery.ts'
import { GalleryDemoPage, GalleryIndexPage } from './gallery-view.tsx'

// Checked-in HTML artifacts served through a frame. The explicit map (rather than
// deriving a path from `:name`) keeps traversal and arbitrary disk reads impossible.
const HTML_FRAGMENTS = new Map<string, URL>([
  ['static-frame', new URL('./html/static-frame.html', import.meta.url)],
])

/**
 * Development-only component gallery.
 *
 * The route is always mapped so `remix doctor` sees its controller, but every
 * action returns 404 unless the call-time environment is explicitly development
 * or test. The allowlist (rather than "not production") keeps a staging
 * deployment or a server started without NODE_ENV from exposing a route that
 * dynamically imports files from disk. In development and test it scans the
 * `app/ui` tree for `*.demo.tsx` / `*.demo.ts` files, server-renders the index,
 * and wraps a selected demo in a client entry so interactive demos hydrate
 * through the normal asset server and import map.
 */
export default createController(routes.ui, {
  actions: {
    index(context) {
      if (!galleryAvailable()) return notFound()

      return context.render(<GalleryIndexPage demos={discoverDemoFiles()} />, {
        headers: { 'Cache-Control': 'no-store' },
      })
    },

    async demo(context) {
      if (!galleryAvailable()) return notFound()

      let filename = context.params.filename
      if (typeof filename !== 'string') return notFound()

      let demo = findDemoFile(filename)
      if (demo === undefined) return notFound()

      try {
        let assetHref = await assetServer.getHref(demo.absolutePath)
        let DemoComponent = clientEntry(
          `${assetHref}#default`,
          await loadDemoModule(demo),
        ) as EntryComponent

        return context.render(<GalleryDemoPage demo={demo} DemoComponent={DemoComponent} />, {
          headers: { 'Cache-Control': 'no-store' },
        })
      } catch (error) {
        return demoFailure(demo.filename, error)
      }
    },

    // Streams a checked-in HTML artifact from disk. `createFileResponse()` owns
    // the MIME type, length, ETag/Last-Modified, HEAD, and conditional requests;
    // `openLazyFile()` means the file is not read until the response body is
    // consumed. No component renderer is involved — a `<Frame>` can adopt the
    // response as ordinary DOM, exactly like the upstream lazy-frames demo.
    html(context) {
      if (!galleryAvailable()) return notFound()

      let name = context.params.name
      if (typeof name !== 'string') return notFound()

      let url = HTML_FRAGMENTS.get(name)
      if (url === undefined) return notFound()

      let filename: string
      try {
        // Resolve at request time so a non-file `import.meta.url` in a future
        // bundling/runtime degrades to 404 instead of failing module import.
        filename = fileURLToPath(url)
      } catch {
        return notFound()
      }

      return createFileResponse(openLazyFile(filename), context.request, {
        cacheControl: 'no-store',
        // Already off by default for HTML; pinned here so the contract is explicit.
        acceptRanges: false,
      })
    },
  },
})

function galleryAvailable(): boolean {
  return isExplicitDevelopmentEnv() || isExplicitTestEnv()
}

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

function demoFailure(filename: string, error: unknown): Response {
  let message = error instanceof Error ? error.message : String(error)

  return new Response(`Demo "${filename}" failed to load:\n\n${message}`, {
    status: 500,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
