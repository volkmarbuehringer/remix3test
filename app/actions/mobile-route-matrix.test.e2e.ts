import { before, describe, it, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import type { Page } from 'playwright'

import { router } from '../test-router.ts'
import { routes } from '../routes.ts'
import { initializeAppDatabase } from '../db.ts'
import { createAuthCookieWithCsrfForUser } from '../../test/utils.ts'
import { assertMobilePage } from '../../test/responsive.ts'

// ---------------------------------------------------------------------------
// Cross-route mobile layout smoke matrix.
//
// These pages are the ones most likely to regress on a phone: full-width
// dashboards, bounded admin/Verwaltung grids, chat panes, the appointment
// calendar, and the public marketing/legal pages. Each case loads the real
// server-rendered route at 390×844 and checks the shared invariants in
// test/responsive.ts. Page-specific interaction coverage stays in the feature
// e2e files; this matrix catches page-level overflow and clipping that isolated
// component tests cannot see.
// ---------------------------------------------------------------------------

interface MobilePageCase {
  name: string
  path: string
  ready: string
  noHorizontalScroll?: string[]
}

const CASES: MobilePageCase[] = [
  { name: 'home', path: routes.home.href(), ready: 'main' },
  {
    name: 'notifications',
    path: routes.notifications.index.href(),
    ready: 'main',
  },
  { name: 'lists', path: routes.lists.index.href(), ready: '#lists-title' },
  { name: 'chat', path: routes.chat.index.href(), ready: '#chat-messages' },
  {
    name: 'appointment calendar',
    path: routes.appointment.index.href(),
    ready: '[data-appointment-grid]',
  },
  {
    name: 'appointments-new',
    path: routes.appointmentsNew.index.href(),
    ready: '[data-appointments-table]',
    noHorizontalScroll: ['[data-appointments-table]'],
  },
  { name: 'admin dashboard', path: routes.admin.index.href(), ready: 'main' },
  {
    name: 'admin chatlog',
    path: routes.admin.chatlog.index.href(),
    ready: '[data-chatlog-table]',
    noHorizontalScroll: ['[data-chatlog-table]'],
  },
  {
    name: 'admin messages',
    path: routes.admin.messages.index.href(),
    ready: '[data-messages-table]',
    noHorizontalScroll: ['[data-messages-table]'],
  },
  {
    name: 'admin lists',
    path: routes.admin.lists.index.href(),
    ready: '[data-lists-table]',
    noHorizontalScroll: ['[data-lists-table]'],
  },
  {
    name: 'admin uploads',
    path: routes.admin.uploads.index.href(),
    ready: '[data-kind-tabs]',
    noHorizontalScroll: ['[data-grid-scroll]'],
  },
  {
    name: 'admin uploadnew',
    path: routes.admin.uploadnew.index.href(),
    ready: '#uploadnew-file',
  },
  {
    name: 'admin webhook requests',
    path: routes.admin.webhookRequests.index.href(),
    ready: '[data-grid-scroll]',
    noHorizontalScroll: ['[data-grid-scroll]'],
  },
  {
    name: 'admin agent events',
    path: routes.admin.agentEvents.index.href(),
    ready: '#agent-events-frame-container',
  },
  {
    name: 'admin support agent',
    path: routes.admin.supportAgent.index.href(),
    ready: '#chat-messages',
  },
  { name: 'verwaltung dashboard', path: routes.verwaltung.index.href(), ready: 'main' },
  {
    name: 'verwaltung offerings',
    path: routes.verwaltung.offerings.index.href(),
    ready: '[data-offerings-table]',
    noHorizontalScroll: ['[data-grid-scroll]'],
  },
  {
    name: 'verwaltung appointments',
    path: routes.verwaltung.appointments.index.href(),
    ready: '[data-appointments-table]',
    noHorizontalScroll: ['[data-grid-scroll]'],
  },
  {
    name: 'verwaltung resources',
    path: routes.verwaltung.resources.index.href(),
    ready: '[data-resources-table]',
    noHorizontalScroll: ['[data-grid-scroll]'],
  },
  {
    name: 'verwaltung offering configs',
    path: routes.verwaltung.offeringConfigs.index.href(),
    ready: '[data-offering-configs-table]',
    noHorizontalScroll: ['[data-grid-scroll]'],
  },
  {
    name: 'verwaltung report1',
    path: routes.verwaltung.report1.index.href(),
    ready: '[data-report1-filters]',
  },
  {
    name: 'verwaltung users export',
    path: routes.verwaltung.usersExport.index.href(),
    ready: 'main',
  },
  { name: 'impressum', path: '/impressum', ready: 'main' },
  { name: 'datenschutz', path: '/datenschutz', ready: 'main' },
]

async function openAdminPage(t: TestContext): Promise<Page> {
  let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
  assert.ok(auth?.cookie, 'admin session must be created')

  let server = await createTestServer((request) => router.fetch(request))
  let page = await t.serve(server)
  await page
    .context()
    .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
  return page
}

describe('mobile route matrix', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  for (let pageCase of CASES) {
    it(`${pageCase.name} fits a 390px viewport`, async (t) => {
      let page = await openAdminPage(t)
      await assertMobilePage(page, pageCase)
    })
  }
})
