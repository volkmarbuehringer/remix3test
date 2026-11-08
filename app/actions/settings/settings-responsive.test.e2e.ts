import { before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { assertMobilePage } from '../../../test/responsive.ts'

// ---------------------------------------------------------------------------
// Settings: mobile layout.
//
// /settings renders its tab nav outside the frame and the active panel inside a
// blocking frame, so the server HTML already contains the content. Each tab is
// loaded directly at 390px to cover the profile, display, password, and account
// panels (the account panel is the widest form, with the password confirmation).
// ---------------------------------------------------------------------------

const TABS = [
  {
    name: 'profile',
    tab: 'profile',
    ready: '#settings-profile',
    landmarks: ['[data-settings-role]'],
  },
  {
    name: 'display',
    tab: 'display',
    ready: '#settings-display',
    landmarks: [
      '#settings-display [data-page-size-select]',
      '#settings-display button[type="submit"]',
    ],
  },
  {
    name: 'password',
    tab: 'password',
    ready: '#settings-password',
    landmarks: [
      '#settings-password input[name="currentPassword"]',
      '#settings-password input[name="newPassword"]',
    ],
  },
  {
    name: 'account',
    tab: 'account',
    ready: '#settings-account',
    landmarks: [
      '#settings-account input[name="currentPassword"]',
      '#settings-account input[name="confirmDelete"]',
    ],
  },
] as const

describe('settings: mobile layout', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  for (let settingsTab of TABS) {
    it(`${settingsTab.name} tab fits a 390px viewport`, async (t) => {
      let auth = await createAuthCookieWithCsrfForUser('user@newapp.com')
      assert.ok(auth?.cookie, 'user session must be created')

      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

      await assertMobilePage(page, {
        path: `${routes.settings.index.href()}?tab=${settingsTab.tab}`,
        ready: settingsTab.ready,
        landmarks: [
          'main',
          'nav[aria-label="Bereiche der Einstellungen"]',
          settingsTab.ready,
          ...settingsTab.landmarks,
        ],
      })
    })
  }
})
