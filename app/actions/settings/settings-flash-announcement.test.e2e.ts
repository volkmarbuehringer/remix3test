import { before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// Settings: the in-frame page-size PRG feeds the persistent flash live region.
//
// The form posts with data-rmx-target="settings-panel"; the frame runtime
// follows the 303 in-frame (frameRedirects) and swaps in the fragment whose
// FlashFragment renders the success banner. The banner has no live role, so the
// document shell's FlashAnnouncer must hydrate and mirror it into
// [data-flash-status] — the path the direct-render browser test cannot cover.
// ---------------------------------------------------------------------------

const MESSAGE = 'Einträge pro Seite gespeichert.'

describe('settings: in-frame PRG flash announcement', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('mirrors the page-size success flash into the persistent live region', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    assert.ok(auth?.cookie, 'user session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(`${routes.settings.index.href()}?tab=display`)

    let form = page.locator('#settings-display form')
    await form.waitFor({ timeout: 15_000 })

    let region = page.locator('[data-flash-status]')
    await region.waitFor({ state: 'attached', timeout: 15_000 })
    assert.equal(await region.textContent(), '', 'the live region starts empty on a clean load')

    await form.locator('select[name="pageSize"]').selectOption('25')
    await form.locator('button[type="submit"]').click()

    // The frame swaps in the fragment; the announcer's observer must fill the
    // persistent region after hydration.
    await page.waitForFunction(
      (message: string) => document.querySelector('[data-flash-status]')?.textContent === message,
      MESSAGE,
      { timeout: 15_000 },
    )

    let banner = page.locator('[data-flash-banner][data-flash-tone="success"]')
    await banner.waitFor({ timeout: 15_000 })
    assert.equal((await banner.textContent())?.trim(), MESSAGE)
  })
})
