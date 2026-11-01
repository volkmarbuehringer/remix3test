import { afterEach, before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { routes } from '../../routes.ts'
import { router } from '../../test-router.ts'

const BASE = 'https://remix.run'
const BUTTON_DEMO_URL = `${BASE}/ui/demo/theme/button.demo.tsx`

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

  it('returns 404 for unknown demos and traversal attempts', async () => {
    let unknown = await router.fetch(`${BASE}/ui/demo/theme/missing.demo.tsx`)
    assert.equal(unknown.status, 404)

    let traversal = await router.fetch(`${BASE}/ui/demo/%2e%2e%2fapp%2froutes.ts`)
    assert.equal(traversal.status, 404)
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
    }
  })
})
