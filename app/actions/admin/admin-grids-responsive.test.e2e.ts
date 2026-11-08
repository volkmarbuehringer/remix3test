import { afterEach, before, describe, it, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import type { Page } from 'playwright'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { assertMobileCards, assertMobilePage } from '../../../test/responsive.ts'
import { PAGE_SIZE_MOBILE_DEFAULT } from '../../utils/get-page-size.ts'

// ---------------------------------------------------------------------------
// Admin grids: mobile layout.
//
// The clients and users grids use the shared `table.mobileCards` breakpoint,
// which hides the column header and turns every row into a labelled card below
// 768px. These pages already have desktop e2e coverage; this file covers the
// phone layout that the component browser tests cannot reach.
// ---------------------------------------------------------------------------

const PREFIX = `mobile-grid-${Date.now()}`
const CLIENTS_PATH = routes.admin.clients.index.href()
const USERS_PATH = routes.admin.users.index.href()

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

describe('admin grids: mobile layout', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM clients WHERE email LIKE $1', [`${PREFIX}%`])
  })

  it('clients grid stacks into cards at 390px', async (t) => {
    await pool.query(
      `INSERT INTO clients (name, email, role, status, registered)
       VALUES ($1, $2, 'Viewer', 'Active', $3)`,
      [
        'Mobile Layout Client With A Long Name',
        `${PREFIX}-client-with-a-long-address@example.com`,
        Date.now(),
      ],
    )

    let page = await openAdminPage(t)
    await assertMobilePage(page, {
      path: CLIENTS_PATH,
      ready: '[data-clients-table]',
      landmarks: ['main', '[data-clients-table]', '[data-clients-table] tbody tr'],
      noHorizontalScroll: ['[data-clients-table-wrap]'],
    })
    await assertMobileCards(page, '[data-clients-table]')

    let editAction = page.locator('[data-clients-table] [title="Bearbeiten"]').first()
    await editAction.waitFor({ timeout: 15_000 })
    assert.ok(await editAction.isVisible(), 'the client row edit action must stay visible')
  })

  it('users grid stacks into cards and keeps row actions visible at 390px', async (t) => {
    let page = await openAdminPage(t)
    await assertMobilePage(page, {
      path: USERS_PATH,
      ready: '[data-users-table]',
      landmarks: [
        'main',
        '[data-users-table]',
        '[data-users-table] tbody tr',
        '[data-users-table] [data-row-actions]',
      ],
      noHorizontalScroll: ['[data-grid-scroll]'],
    })
    await assertMobileCards(page, '[data-users-table]')

    let actions = page.locator('[data-users-table] [data-row-actions]').first()
    let actionStyles = await actions.evaluate((element) => ({
      opacity: getComputedStyle(element).opacity,
      pointerEvents: getComputedStyle(element).pointerEvents,
    }))
    assert.notEqual(actionStyles.opacity, '0', 'row actions must not be hidden at 390px')
    assert.notEqual(actionStyles.pointerEvents, 'none', 'row actions must be interactive at 390px')
  })

  it('renders the phone-sized page once the viewport cookie is set', async (t) => {
    let page = await openAdminPage(t)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(CLIENTS_PATH)
    await page.locator('[data-clients-table]').waitFor({ timeout: 15_000 })

    // The inline bootstrap reports the layout breakpoint to the server.
    let cookies = await page.context().cookies()
    let viewportCookie = cookies.find((cookie) => cookie.name === 'viewport')
    assert.ok(viewportCookie, 'the document bootstrap must write the viewport cookie')
    assert.equal(viewportCookie.value, 'mobile', 'a 390px viewport is the mobile class')

    // The cookie only travels with the next request, so the reload already
    // renders the phone-sized page: a card is ~300px tall, so 15 rows are
    // ~11 screens of scrolling on a phone and 5 rows are ~4.
    await page.reload()
    await page.locator('[data-clients-table]').waitFor({ timeout: 15_000 })
    let rows = await page.locator('[data-clients-table] tbody tr').count()
    assert.equal(rows, PAGE_SIZE_MOBILE_DEFAULT, 'a phone must get the smaller page size')
  })
})
