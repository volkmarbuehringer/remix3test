import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../test-router.ts'

// ---------------------------------------------------------------------------
// Document head resources across a top-level client navigation.
//
// Exercises the head-diff path fixed in the 2026-11-03 pin by #12127 (keep
// stylesheets in place after a leading import map), #12128 (kept head
// resources during DOM diffs), and #12164 (sibling order around preserved DOM
// elements). Keyed-resource preservation itself is covered by the vendor
// tests; this guards the app's shared shell nodes.
//
// A plain same-origin link (no `data-rmx-target`/`data-rmx-document`) becomes
// a top-level frame reload, which diffs the destination document's <head> into
// the current one. The shared fonts stylesheet and the managed import map must
// keep their existing nodes and order; recreating them would re-fetch styles,
// drop module resolution, and flash the page. The probe stored on `window`
// also proves this stayed a client navigation: a full reload would discard it.
// ---------------------------------------------------------------------------

type HeadProbe = {
  fonts: HTMLLinkElement | null
  importMap: HTMLScriptElement | null
  removed: Node[]
}

declare global {
  interface Window {
    __headProbe?: HeadProbe
  }
}

describe('document head resources', () => {
  it('keeps shared head nodes across a client-side navigation', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)

    await page.goto('/auth/login')
    let register = page.getByRole('link', { name: 'Register here' })
    await register.waitFor({ timeout: 15_000 })

    let before = await page.evaluate(() => {
      let fonts = document.head.querySelector<HTMLLinkElement>(
        'link[rel="stylesheet"][href="/fonts/fonts.css"]',
      )
      let importMap = document.head.querySelector<HTMLScriptElement>(
        'script[data-rmx-import-map][type="importmap"]',
      )
      let removed: Node[] = []
      let observer = new MutationObserver((records) => {
        for (let record of records) removed.push(...record.removedNodes)
      })
      observer.observe(document.head, { childList: true })
      window.__headProbe = { fonts, importMap, removed }

      return {
        hasFonts: fonts !== null,
        hasImportMap: importMap !== null,
        title: document.title,
      }
    })

    assert.ok(before.hasFonts, 'login document must render the shared fonts stylesheet')
    assert.ok(before.hasImportMap, 'login document must render the managed import map')
    assert.equal(before.title, 'Sign in')

    await register.click()
    await page.waitForURL('**/auth/register', { timeout: 15_000 })
    await page.getByRole('heading', { name: 'Create your account' }).waitFor({ timeout: 15_000 })

    let after = await page.evaluate(() => {
      let probe = window.__headProbe
      if (!probe) throw new Error('probe lost — the navigation was a full document reload')
      let fontsLinks = document.head.querySelectorAll<HTMLLinkElement>(
        'link[rel="stylesheet"][href="/fonts/fonts.css"]',
      )

      return {
        fontsSame: probe.fonts !== null && document.head.contains(probe.fonts),
        fontsRemoved: probe.fonts !== null && probe.removed.includes(probe.fonts),
        importMapSame: probe.importMap !== null && document.head.contains(probe.importMap),
        importMapRemoved: probe.importMap !== null && probe.removed.includes(probe.importMap),
        fontsLinks: fontsLinks.length,
        title: document.title,
      }
    })

    assert.equal(after.title, 'Create account')
    assert.equal(after.fontsLinks, 1, 'the shared stylesheet must not be duplicated')
    assert.ok(after.fontsSame, 'the shared stylesheet node must be reused')
    assert.ok(!after.fontsRemoved, 'the shared stylesheet must never leave the head')
    assert.ok(after.importMapSame, 'the managed import map must be reused')
    assert.ok(!after.importMapRemoved, 'the managed import map must never leave the head')
  })
})
