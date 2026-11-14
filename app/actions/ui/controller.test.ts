import { afterEach, before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { routes } from '../../routes.ts'
import { router } from '../../test-router.ts'

const BASE = 'https://remix.run'
const BUTTON_DEMO_URL = `${BASE}/ui/demo/theme/button.demo.tsx`
const LAZY_FRAME_DEMO_URL = `${BASE}${routes.ui.demo.href({ filename: 'lazy-frame.demo.tsx' })}`
const HTML_FRAGMENT_URL = `${BASE}${routes.ui.html.href({ name: 'static-frame' })}`
const CSS_FRAGMENT_URL = `${BASE}${routes.ui.css.href({ name: 'static-frame' })}`

describe('UI gallery controller', () => {
  let originalNodeEnv: string | undefined
  let nodeEnvMutated = false

  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(() => {
    if (!nodeEnvMutated) return

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
    originalNodeEnv = undefined
    nodeEnvMutated = false
  })

  it('renders the index with every discovered demo and no-store caching', async () => {
    let response = await router.fetch(`${BASE}${routes.ui.index.href()}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')

    let html = await response.text()
    assert.ok(html.includes('UI-Galerie'), 'index title should render')
    assert.ok(html.includes('theme/button.demo.tsx'), 'button demo should be listed')
    assert.ok(html.includes('theme/glyph.demo.tsx'), 'glyph demo should be listed')
    assert.ok(html.includes('page-primitives.demo.tsx'), 'primitives demo should be listed')
    assert.ok(html.includes('lazy-frame.demo.tsx'), 'lazy-frame demo should be listed')
    assert.ok(html.includes('static-frame'), 'the checked-in HTML fragment should be linked')
  })

  it('renders a demo through the asset-backed client entry', async () => {
    let response = await router.fetch(BUTTON_DEMO_URL)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')

    let html = await response.text()
    assert.ok(html.includes('data-gallery-demo="true"'), 'demo stage should render')
    assert.ok(html.includes('theme/button.demo.tsx'), 'source path should be visible')
    assert.ok(html.includes('dangerOutline'), 'the demo component should render server-side')
    assert.ok(
      /\/assets\/app\/ui\/theme\/button\.demo[^"]*\.tsx/.test(html),
      'the client entry should reference the asset server URL',
    )
  })

  it('renders the lazy-frame demo with a deferred checked-in HTML fragment', async () => {
    let response = await router.fetch(LAZY_FRAME_DEMO_URL)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')

    let html = await response.text()
    assert.ok(html.includes('data-gallery-demo="true"'), 'demo stage should render')
    assert.ok(html.includes('data-gallery-lazy-fallback="true"'), 'the lazy fallback should ship')
    assert.ok(
      html.includes('Statisches HTML-Fragment wird geladen'),
      'the fallback copy should render',
    )
    assert.ok(
      !html.includes('data-static-frame-fragment'),
      'the checked-in fragment must not be resolved into the demo page',
    )
    assert.ok(
      !html.includes('No component renderer required'),
      'the artifact payload must not be inlined',
    )
  })

  it('returns 404 for unknown demos and traversal attempts', async () => {
    let unknown = await router.fetch(`${BASE}/ui/demo/theme/missing.demo.tsx`)
    assert.equal(unknown.status, 404)

    let traversal = await router.fetch(`${BASE}/ui/demo/%2e%2e%2fapp%2froutes.ts`)
    assert.equal(traversal.status, 404)
  })

  it('streams a checked-in HTML fragment with file-response metadata', async () => {
    let response = await router.fetch(HTML_FRAGMENT_URL)

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /^text\/html/)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
    assert.ok(response.headers.get('ETag'), 'the file response supplies a weak ETag')
    assert.ok(response.headers.get('Last-Modified'), 'the file response supplies Last-Modified')
    assert.ok(Number(response.headers.get('Content-Length')) > 0)
    assert.equal(response.headers.get('Accept-Ranges'), null, 'range support is disabled')
    assert.ok(response.body instanceof ReadableStream, 'the body is streamed, not buffered')

    let html = await response.text()
    assert.ok(html.includes('data-static-frame-fragment'), 'the checked-in artifact is served')
    assert.ok(html.includes('openLazyFile'), 'the artifact explains its delivery path')
    assert.ok(
      html.includes(routes.ui.css.href({ name: 'static-frame' })),
      'the artifact links its checked-in stylesheet',
    )
  })

  it('streams the artifact stylesheet with a CSS content type', async () => {
    let response = await router.fetch(CSS_FRAGMENT_URL)

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /^text\/css/)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.ok((await response.text()).includes('[data-static-frame-fragment]'))
  })

  it('answers HEAD for a checked-in fragment without a body', async () => {
    let response = await router.fetch(HTML_FRAGMENT_URL, { method: 'HEAD' })

    assert.equal(response.status, 200)
    assert.ok(Number(response.headers.get('Content-Length')) > 0)
    assert.equal(await response.text(), '')
  })

  it('returns 404 for unknown fragment names and traversal attempts', async () => {
    let unknown = await router.fetch(`${BASE}/ui/html/missing`)
    assert.equal(unknown.status, 404)

    let inherited = await router.fetch(`${BASE}/ui/html/toString`)
    assert.equal(inherited.status, 404, 'prototype properties are not fragment names')

    let traversal = await router.fetch(`${BASE}/ui/html/%2e%2e%2fcontroller`)
    assert.equal(traversal.status, 404)

    let unknownStyles = await router.fetch(`${BASE}/ui/css/missing`)
    assert.equal(unknownStyles.status, 404)

    let inheritedStyles = await router.fetch(`${BASE}/ui/css/toString`)
    assert.equal(inheritedStyles.status, 404, 'prototype properties are not fragment names')
  })

  it('is unavailable outside development and test', async () => {
    // This mutates process.env; remix.json uses pool: "forks", so each test
    // file runs in its own process, and afterEach restores the original value.
    originalNodeEnv = process.env.NODE_ENV
    nodeEnvMutated = true

    for (let nodeEnv of ['production', 'staging']) {
      process.env.NODE_ENV = nodeEnv

      let index = await router.fetch(`${BASE}${routes.ui.index.href()}`)
      assert.equal(index.status, 404, `index should be unavailable in ${nodeEnv}`)

      let demo = await router.fetch(BUTTON_DEMO_URL)
      assert.equal(demo.status, 404, `demo should be unavailable in ${nodeEnv}`)

      let fragment = await router.fetch(HTML_FRAGMENT_URL)
      assert.equal(fragment.status, 404, `html fragments should be unavailable in ${nodeEnv}`)

      let styles = await router.fetch(CSS_FRAGMENT_URL)
      assert.equal(styles.status, 404, `fragment styles should be unavailable in ${nodeEnv}`)
    }
  })
})
