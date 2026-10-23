import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { legal, routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'

const BASE = 'https://remix.run'

// Home page landing surface: metadata, self-hosted fonts, the AI section and
// the legal pages linked from its footer.
describe('Home page — landing surface', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('renders a descriptive title, meta description and social tags', async () => {
    let response = await router.fetch(`${BASE}${routes.home.href()}`)
    assert.equal(response.status, 200, 'home page should render')
    let html = await response.text()
    assert.ok(html.includes('<meta name="description"'), 'description meta tag should be present')
    assert.ok(html.includes('property="og:title"'), 'og:title should be present')
    assert.ok(html.includes('Terminplanung'), 'title should describe the product')
  })

  it('does not reference third-party font CDNs', async () => {
    let response = await router.fetch(`${BASE}${routes.home.href()}`)
    let html = await response.text()
    assert.ok(!html.includes('fonts.googleapis.com'), 'no fonts.googleapis.com')
    assert.ok(!html.includes('fonts.gstatic.com'), 'no fonts.gstatic.com')
    assert.ok(html.includes('/fonts/fonts.css'), 'self-hosted font stylesheet should be linked')
  })

  it('serves the self-hosted font stylesheet from /fonts', async () => {
    let response = await router.fetch(`${BASE}/fonts/fonts.css`)
    assert.equal(response.status, 200, 'font stylesheet should be served')
    assert.ok(
      (response.headers.get('Content-Type') ?? '').includes('text/css'),
      'font stylesheet should be text/css',
    )
    let css = await response.text()
    assert.ok(css.includes("font-family: 'Inter'"), 'stylesheet should declare Inter')
    assert.ok(
      css.includes("font-family: 'JetBrains Mono'"),
      'stylesheet should declare JetBrains Mono',
    )
  })

  it('serves the self-hosted woff2 files', async () => {
    for (let file of ['inter.woff2', 'jetbrains-mono.woff2']) {
      let response = await router.fetch(`${BASE}/fonts/${file}`)
      assert.equal(response.status, 200, `${file} should be served`)
      assert.ok(
        (response.headers.get('Content-Type') ?? '').includes('font/woff2'),
        `${file} should be served as font/woff2`,
      )
    }
  })

  it('serves byte ranges and ignores unsupported range units for woff2 files', async () => {
    let url = `${BASE}/fonts/inter.woff2`
    let full = await router.fetch(url)
    assert.equal(full.status, 200, 'woff2 should be served in full')
    let length = Number(full.headers.get('Content-Length'))
    assert.ok(Number.isFinite(length) && length > 0, 'woff2 should have a content length')

    let partial = await router.fetch(url, { headers: { Range: 'bytes=0-9' } })
    assert.equal(partial.status, 206, 'a byte range should return partial content')
    assert.equal(partial.headers.get('Content-Range'), `bytes 0-9/${length}`)
    assert.equal((await partial.arrayBuffer()).byteLength, 10, 'partial body should be ten bytes')

    let unsupported = await router.fetch(url, { headers: { Range: 'items=0-9' } })
    assert.equal(unsupported.status, 200, 'unsupported range units should be ignored')

    let emptySuffix = await router.fetch(url, { headers: { Range: 'bytes=-0' } })
    assert.equal(emptySuffix.status, 416, 'an empty suffix range should be unsatisfiable')
    assert.equal(emptySuffix.headers.get('Content-Range'), `bytes */${length}`)
  })

  it('revalidates static font ETags with a strong If-None-Match validator', async () => {
    let url = `${BASE}/fonts/inter.woff2`
    let first = await router.fetch(url)
    assert.equal(first.status, 200, 'woff2 should be served')
    let etag = first.headers.get('ETag')
    assert.ok(etag, 'static files should emit an ETag')
    assert.ok(etag.startsWith('W/"'), 'static files should emit a weak ETag')

    let revalidated = await router.fetch(url, {
      headers: { 'If-None-Match': etag.slice(2) },
    })
    assert.equal(revalidated.status, 304, 'a strong validator should match the weak ETag')
    assert.equal(revalidated.headers.get('ETag'), etag, '304 should echo the ETag')
  })

  it('renders the legal pages and the footer links to them', async () => {
    let pages: Array<[string, string]> = [
      [legal.impressum.href(), 'Impressum'],
      [legal.datenschutz.href(), 'Datenschutzerklärung'],
    ]
    for (let [href, heading] of pages) {
      let response = await router.fetch(`${BASE}${href}`)
      assert.equal(response.status, 200, `${href} should render`)
      let html = await response.text()
      assert.ok(html.includes(heading), `${href} should show its heading`)
    }

    let home = await router.fetch(`${BASE}${routes.home.href()}`)
    let html = await home.text()
    assert.ok(html.includes(legal.impressum.href()), 'home footer should link the Impressum')
    assert.ok(html.includes(legal.datenschutz.href()), 'home footer should link the Datenschutz')
  })

  it('highlights the AI assistance section without fabricated social proof', async () => {
    let response = await router.fetch(`${BASE}${routes.home.href()}`)
    let html = await response.text()
    assert.ok(html.includes('id="ki-assistenz"'), 'AI assistance section should be present')
    assert.ok(!html.includes('12+'), 'should not claim a fabricated customer count')
    assert.ok(html.includes('Keine Tracker Dritter'), 'should show verifiable trust facts')
  })

  it('bootstraps the theme from the OS preference when none is chosen', async () => {
    let response = await router.fetch(`${BASE}${routes.home.href()}`)
    let html = await response.text()
    assert.ok(
      html.includes('prefers-color-scheme: dark'),
      'theme bootstrap should read the OS colour-scheme preference',
    )
    assert.ok(html.includes("localStorage.getItem('theme')"), 'explicit choice should win')
  })

  it('hides the decorative hero mockup from assistive technology', async () => {
    let response = await router.fetch(`${BASE}${routes.home.href()}`)
    let html = await response.text()
    assert.ok(html.includes('aria-hidden="true"'), 'decorative hero visual should be aria-hidden')
  })
})
