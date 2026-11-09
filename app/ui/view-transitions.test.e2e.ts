import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../test-router.ts'
import { routes } from '../routes.ts'

// ---------------------------------------------------------------------------
// Cross-document View Transitions in the shared document shell.
//
// The server suite asserts the emitted CSS text; this e2e proves the browser
// parses it into a real @view-transition rule and that a full-document
// navigation actually starts a transition. The app's normal navigation is
// frame-based, so activation is also the signal that this stayed a document
// navigation. Chromium is the reference engine; Firefox is allowed to ignore
// the at-rule (progressive enhancement) and only the unsupported path is
// asserted there.
// ---------------------------------------------------------------------------

describe('document view transitions', () => {
  it('parses the shell opt-in and names persistent chrome', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)

    await page.goto(routes.auth.login.index.href())

    let parsed = await page.evaluate(() => {
      let optIn = false
      for (let sheet of document.styleSheets) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue
        }
        for (let rule of Array.from(rules)) {
          if (!(rule instanceof CSSMediaRule)) continue
          if (!rule.conditionText.includes('prefers-reduced-motion: no-preference')) continue
          for (let inner of Array.from(rule.cssRules)) {
            if (
              inner.cssText.includes('@view-transition') &&
              inner.cssText.includes('navigation: auto')
            ) {
              optIn = true
            }
          }
        }
      }

      let header = document.querySelector('header')
      return {
        optIn,
        headerName: header ? getComputedStyle(header).viewTransitionName : '',
        supportsViewTransitions: CSS.supports('view-transition-name: root'),
      }
    })

    let browserName = page.context().browser()?.browserType().name()

    if (parsed.supportsViewTransitions) {
      assert.equal(parsed.headerName, 'app-header', 'the header must be a named transition group')
    }
    if (browserName === 'chromium') {
      assert.equal(parsed.optIn, true, 'the shell must parse @view-transition { navigation: auto }')
    }
  })

  it('activates on a full-document navigation, not on frame navigation', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)

    await page.addInitScript(() => {
      // Init scripts run per document. sessionStorage survives the navigation,
      // so each document records that its own pageswap/pagereveal carried a
      // ViewTransition object.
      addEventListener('pageswap', (event) => {
        if ((event as PageSwapEvent).viewTransition) {
          sessionStorage.setItem('vt-pageswap', '1')
        }
      })
      addEventListener('pagereveal', (event) => {
        if ((event as PageRevealEvent).viewTransition) {
          sessionStorage.setItem('vt-pagereveal', '1')
        }
      })
    })

    await page.goto(routes.auth.login.index.href())
    let browserName = page.context().browser()?.browserType().name()

    // A real link click marked `data-rmx-document` forces a full document
    // navigation (Playwright's goto is a browser-initiated navigation that the
    // platform does not treat like a page-initiated one). Cross-document VT
    // requires the same origin and both documents to opt in; both render the
    // shared shell.
    await page.evaluate(() => {
      sessionStorage.removeItem('vt-pageswap')
      sessionStorage.removeItem('vt-pagereveal')
      let link = document.createElement('a')
      link.href = '/'
      link.textContent = 'document navigation probe'
      link.setAttribute('data-rmx-document', '')
      document.body.append(link)
      link.click()
    })
    await page.waitForURL((url) => url.pathname === routes.home.href(), { timeout: 15_000 })

    let probe = await page.evaluate(() => ({
      swap: sessionStorage.getItem('vt-pageswap'),
      reveal: sessionStorage.getItem('vt-pagereveal'),
    }))

    if (browserName === 'chromium') {
      assert.equal(probe.swap, '1', 'leaving the login document should start a swap transition')
      assert.equal(probe.reveal, '1', 'arriving at home should reveal through a transition')
    }

    // Now exercise the ordinary top-level frame navigation (client-side DOM
    // diff). It must not produce another cross-document transition.
    await page.goto(routes.auth.login.index.href())
    await page.evaluate(() => sessionStorage.removeItem('vt-pagereveal'))
    await page.getByRole('link', { name: 'Register here' }).click()
    await page.waitForURL('**/auth/register', { timeout: 15_000 })

    let frameProbe = await page.evaluate(() => sessionStorage.getItem('vt-pagereveal'))
    assert.equal(frameProbe, null, 'a frame/client navigation must not start a document transition')
  })
})
