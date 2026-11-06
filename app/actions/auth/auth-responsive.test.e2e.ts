import { before, describe, it } from 'remix/test'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { assertMobilePage } from '../../../test/responsive.ts'

// ---------------------------------------------------------------------------
// Auth pages: mobile layout.
//
// The auth pages are public and share the centered AuthShell card. At a 390px
// viewport the card must fit without horizontal clipping, and the fields and
// submit action must stay visible and large enough to tap.
// ---------------------------------------------------------------------------

const CASES = [
  {
    name: 'login',
    path: routes.auth.login.index.href(),
    landmarks: [
      'main',
      'form input[name="email"]',
      'form input[name="password"]',
      'form button[type="submit"]',
    ],
  },
  {
    name: 'register',
    path: routes.auth.register.index.href(),
    landmarks: [
      'main',
      'form input[name="name"]',
      'form input[name="email"]',
      'form input[name="password"]',
      'form input[name="confirmPassword"]',
      'form button[type="submit"]',
    ],
  },
  {
    name: 'forgotten password',
    path: routes.auth.forgotten.index.href(),
    landmarks: ['main', 'form input[name="email"]', 'form button[type="submit"]'],
  },
] as const

describe('auth pages: mobile layout', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  for (let authPage of CASES) {
    it(`${authPage.name} fits a 390px viewport`, async (t) => {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)

      await assertMobilePage(page, {
        path: authPage.path,
        ready: 'main',
        landmarks: [...authPage.landmarks],
      })
    })
  }
})
