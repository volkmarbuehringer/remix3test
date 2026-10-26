import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser, createTestUser } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// Regression: the persistent nav bell did not refresh its unread badge after
// marking a notification read. The inbox form is intercepted as a soft
// navigation, so the nav (and the bell's client-entry state) survives the
// submission; a mount-only count fetch therefore stayed stale.
// ---------------------------------------------------------------------------

describe('notifications inbox bell count', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('drops the bell badge after marking a notification read without a document reload', async (t) => {
    let email = `notif-bell-${Date.now()}-${Math.random()}@example.com`
    let userId = await createTestUser(email)
    assert.ok(userId != null, 'test user must be created')

    let inserted = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, appointment_id, read_at, created_at)
       VALUES ($1, 'confirmation', 'Titel', 'Inhalt', NULL, NULL, $2) RETURNING id`,
      [userId, Date.now()],
    )
    let notificationId = Number(inserted.rows[0]!.id as number)

    try {
      let auth = await createAuthCookieWithCsrfForUser(email)
      assert.ok(auth?.cookie, 'session must be created')

      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

      let loads = 0
      page.on('load', () => {
        loads++
      })

      // The bell's initial count fetch means hydration finished.
      let hydrated = page.waitForResponse(
        (response) => response.url().includes('/notifications/unread-count'),
        { timeout: 15_000 },
      )
      await page.goto(routes.notifications.index.href())
      await hydrated

      await page.waitForFunction(
        () => document.querySelector('[data-bell-count]')?.textContent === '1',
        undefined,
        { timeout: 15_000 },
      )

      await page.locator('button:text-is("Als gelesen")').first().click()

      await page.waitForFunction(
        () => document.querySelector('[data-bell-count]') === null,
        undefined,
        { timeout: 15_000 },
      )

      assert.equal(loads, 1, 'marking read must stay a soft navigation')

      let row = await pool.query('SELECT read_at FROM notifications WHERE id = $1', [
        notificationId,
      ])
      assert.notEqual(row.rows[0]?.read_at, null, 'the notification should be marked read')
    } finally {
      await pool.query('DELETE FROM notifications WHERE id = $1', [notificationId])
    }
  })

  it('drops the bell badge after marking all notifications read without a document reload', async (t) => {
    let email = `notif-bell-all-${Date.now()}-${Math.random()}@example.com`
    let userId = await createTestUser(email)
    assert.ok(userId != null, 'test user must be created')

    let inserted = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, appointment_id, read_at, created_at)
       VALUES ($1, 'reminder', 'Titel', 'Inhalt', NULL, NULL, $2) RETURNING id`,
      [userId, Date.now()],
    )
    let notificationId = Number(inserted.rows[0]!.id as number)

    try {
      let auth = await createAuthCookieWithCsrfForUser(email)
      assert.ok(auth?.cookie, 'session must be created')

      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

      let loads = 0
      page.on('load', () => {
        loads++
      })

      let hydrated = page.waitForResponse(
        (response) => response.url().includes('/notifications/unread-count'),
        { timeout: 15_000 },
      )
      await page.goto(routes.notifications.index.href())
      await hydrated

      await page.waitForFunction(
        () => document.querySelector('[data-bell-count]')?.textContent === '1',
        undefined,
        { timeout: 15_000 },
      )

      await page.locator('button:text-is("Alle als gelesen markieren")').click()

      await page.waitForFunction(
        () => document.querySelector('[data-bell-count]') === null,
        undefined,
        { timeout: 15_000 },
      )

      assert.equal(loads, 1, 'marking all read must stay a soft navigation')

      let row = await pool.query('SELECT read_at FROM notifications WHERE id = $1', [
        notificationId,
      ])
      assert.notEqual(row.rows[0]?.read_at, null, 'the notification should be marked read')
    } finally {
      await pool.query('DELETE FROM notifications WHERE id = $1', [notificationId])
    }
  })
})
