import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'

// ---------------------------------------------------------------------------
// UI gallery: lazy frame around a checked-in HTML fragment.
//
// The demo is the dev-only counterpart to the production lazy frames: its
// `Frame loading="lazy"` points at `/ui/html/static-frame`, which streams a
// plain HTML file with no component renderer. The server test pins that the
// demo page ships only the fallback; this test proves the browser defers the
// fragment until the fallback approaches the viewport and keeps it mounted.
//
// The demo puts the frame inside its own scroll container so the fallback is
// clipped like the admin page's `[data-page-scroller]`; without that clip the
// runtime's one-viewport preload margin would load a frame just below the fold.
// ---------------------------------------------------------------------------

const DEMO_PATH = routes.ui.demo.href({ filename: 'lazy-frame.demo.tsx' })
const FRAGMENT_PATH = routes.ui.html.href({ name: 'static-frame' })
const ARTIFACT_HEADING = 'No component renderer required'

describe('UI gallery: lazy frame with checked-in HTML', () => {
  it('loads the fragment when the fallback approaches the viewport', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page.setViewportSize({ width: 1280, height: 720 })

    let fragmentRequests = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === FRAGMENT_PATH) fragmentRequests++
    })

    await page.goto(DEMO_PATH)
    let scroller = page.locator('[data-gallery-lazy-viewport]')
    await scroller.waitFor({ timeout: 15_000 })
    let fallback = page.locator('[data-gallery-lazy-fallback]')
    await fallback.waitFor({ state: 'attached', timeout: 15_000 })

    // The demo's scroll cue keeps the frame below the scroller's fold. If this
    // geometry changes, the zero-request assertion is no longer meaningful and
    // the test must be re-based rather than silently passing.
    let fallbackBelowFold = await fallback.evaluate((element) => {
      let scrollContainer = element.closest('[data-gallery-lazy-viewport]')
      if (!scrollContainer) return false
      return element.getBoundingClientRect().top > scrollContainer.getBoundingClientRect().bottom
    })
    assert.ok(fallbackBelowFold, 'the lazy fallback must start below the scroller fold')

    assert.equal(
      await page.getByText(ARTIFACT_HEADING, { exact: true }).count(),
      0,
      'the fragment must not be inlined into the demo page',
    )
    assert.equal(fragmentRequests, 0, 'the offscreen frame must not be requested')

    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await page.getByText(ARTIFACT_HEADING, { exact: true }).waitFor({ timeout: 15_000 })

    assert.equal(
      fragmentRequests,
      1,
      'the frame loads exactly once when it approaches the viewport',
    )

    // Loaded lazy content stays mounted: scrolling away and back must not
    // refetch the fragment.
    await scroller.evaluate((element) => {
      element.scrollTop = 0
    })
    await page.waitForTimeout(100)
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    assert.equal(fragmentRequests, 1, 'further scrolling must not refetch the fragment')
    assert.equal(
      await page.getByText(ARTIFACT_HEADING, { exact: true }).count(),
      1,
      'the loaded fragment stays in the DOM',
    )
  })
})
