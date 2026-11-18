import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { frames, routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser, createTestUser } from '../../../test/utils.ts'
import { broadcastNotification } from '../../utils/notifications-sse.ts'

// ---------------------------------------------------------------------------
// Regression: the inbox was static. The per-user SSE channel already pushed
// `new`, but only the nav bell listened, so a notification that landed while
// the inbox was open stayed invisible until the next navigation. The live
// entry reloads the page's frame on `new`; this proves the browser path end to
// end: subscription → broadcast → in-place refresh with no document load.
//
// The same entry enhances the panel's POST forms (mark read/all read, page
// size): they are fetched, their 303 is not followed, and the panel reloads.
// The mutation tests pin that the URL/history stay put and that only the
// `notifications-content` frame is re-requested.
// ---------------------------------------------------------------------------

describe('notifications inbox live refresh', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('adds a broadcast notification without a document reload', async (t) => {
    let email = `notif-live-${Date.now()}-${Math.random()}@example.com`
    let userId = await createTestUser(email)
    assert.ok(userId != null, 'test user must be created')

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

    // Both the nav bell and the inbox entry subscribe on this page.
    let streams = 0
    page.on('response', (response) => {
      if (response.url().includes(routes.notifications.events.href())) streams++
    })

    // The initial document GET has no target; the live reload must ask for the
    // `notifications-content` frame only.
    let pageRequests: string[] = []
    page.on('request', (request) => {
      if (request.method() !== 'GET') return
      if (new URL(request.url()).pathname !== routes.notifications.index.href()) return
      pageRequests.push(request.headers()['x-remix-target'] ?? '')
    })

    await page.goto(routes.notifications.index.href())
    await page.locator('[data-notifications-live]').waitFor({ state: 'attached' })
    await t.waitFor(() => assert.ok(streams >= 2, 'both live subscriptions must connect'), {
      timeout: 15_000,
    })

    let title = `Live-Titel ${Date.now()}`
    let notificationId: number | undefined
    try {
      let inserted = await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, appointment_id, read_at, created_at)
         VALUES ($1, 'confirmation', $2, 'Inhalt', NULL, NULL, $3) RETURNING id`,
        [userId, title, Date.now()],
      )
      notificationId = Number(inserted.rows[0]!.id)

      broadcastNotification(userId, { id: notificationId, type: 'confirmation', title })

      await page.waitForFunction(
        (expected) => document.body.textContent?.includes(expected) === true,
        title,
        { timeout: 15_000 },
      )

      assert.equal(loads, 1, 'the live refresh must not reload the document')
      assert.equal(
        pageRequests.at(-1),
        frames.notificationsContent,
        'the live refresh must request only the notifications-content frame',
      )
      assert.ok(
        page.url().endsWith(routes.notifications.index.href()),
        'the frame reload must not change the URL',
      )
    } finally {
      if (notificationId != null) {
        await pool.query('DELETE FROM notifications WHERE id = $1', [notificationId])
      }
    }
  })

  it('marks a notification read in place without navigating', async (t) => {
    let email = `notif-read-${Date.now()}-${Math.random()}@example.com`
    let userId = await createTestUser(email)
    assert.ok(userId != null, 'test user must be created')

    let auth = await createAuthCookieWithCsrfForUser(email)
    assert.ok(auth?.cookie, 'session must be created')

    let written = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, appointment_id, read_at, created_at)
       VALUES ($1, 'confirmation', 'Inhalt', 'Inhalt', NULL, NULL, $2) RETURNING id`,
      [userId, Date.now()],
    )
    let notificationId = Number(written.rows[0]!.id)

    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

      let loads = 0
      page.on('load', () => {
        loads++
      })

      let streams = 0
      page.on('response', (response) => {
        if (response.url().includes(routes.notifications.events.href())) streams++
      })

      // The mutation's followed redirect is a plain document GET; the reload
      // that follows it must ask for the frame target.
      let pageRequests: string[] = []
      page.on('request', (request) => {
        if (request.method() !== 'GET') return
        if (new URL(request.url()).pathname !== routes.notifications.index.href()) return
        pageRequests.push(request.headers()['x-remix-target'] ?? '')
      })

      await page.goto(routes.notifications.index.href())
      // Both subscriptions come from the queueTask that also installs the
      // submit listener, so this waits for the enhancement to be active.
      await t.waitFor(() => assert.ok(streams >= 2, 'both live subscriptions must connect'), {
        timeout: 15_000,
      })

      await page.locator('button:text-is("Als gelesen")').first().click()

      // The panel reload removes the row's mark-read action.
      await page.waitForFunction(
        () =>
          ![...document.querySelectorAll('button')].some(
            (button) => button.textContent?.trim() === 'Als gelesen',
          ),
        undefined,
        { timeout: 15_000 },
      )

      assert.equal(loads, 1, 'marking read must not reload the document')
      let current = new URL(page.url())
      assert.equal(current.pathname, routes.notifications.index.href(), 'the URL must not change')
      assert.equal(current.search, '', 'the URL must not gain the action path')
      assert.equal(
        pageRequests.at(-1),
        frames.notificationsContent,
        'the mutation must reload only the notifications-content frame',
      )

      let row = await pool.query('SELECT read_at FROM notifications WHERE id = $1', [
        notificationId,
      ])
      assert.notEqual(row.rows[0]?.read_at, null, 'the notification should be marked read')
    } finally {
      await pool.query('DELETE FROM notifications WHERE id = $1', [notificationId])
    }
  })

  it('saves a page size in place without navigating', async (t) => {
    let email = `notif-size-${Date.now()}-${Math.random()}@example.com`
    let userId = await createTestUser(email)
    assert.ok(userId != null, 'test user must be created')

    let auth = await createAuthCookieWithCsrfForUser(email)
    assert.ok(auth?.cookie, 'session must be created')

    let inserted = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, appointment_id, read_at, created_at)
       SELECT $1, 'confirmation', 'Eintrag ' || i, 'Inhalt', NULL, NULL, $2::bigint - i
       FROM generate_series(1, 20) AS i
       RETURNING id`,
      [userId, Date.now()],
    )
    assert.equal(inserted.rowCount, 20, 'the inbox must paginate')

    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

      let loads = 0
      page.on('load', () => {
        loads++
      })

      let streams = 0
      page.on('response', (response) => {
        if (response.url().includes(routes.notifications.events.href())) streams++
      })

      let pageRequests: string[] = []
      page.on('request', (request) => {
        if (request.method() !== 'GET') return
        if (new URL(request.url()).pathname !== routes.notifications.index.href()) return
        pageRequests.push(request.headers()['x-remix-target'] ?? '')
      })

      await page.goto(routes.notifications.index.href())
      await t.waitFor(() => assert.ok(streams >= 2, 'both live subscriptions must connect'), {
        timeout: 15_000,
      })
      await page.waitForFunction(
        () => document.querySelectorAll('[data-notification-id]').length === 15,
        undefined,
        { timeout: 15_000 },
      )

      await page.locator('select[name="pageSize"]').selectOption('5')
      await page.locator('button:text-is("Speichern")').click()

      await page.waitForFunction(
        () => document.querySelectorAll('[data-notification-id]').length === 5,
        undefined,
        { timeout: 15_000 },
      )

      assert.equal(loads, 1, 'saving the page size must not reload the document')
      assert.equal(
        new URL(page.url()).pathname,
        routes.notifications.index.href(),
        'the URL must not change',
      )
      assert.equal(
        pageRequests.at(-1),
        frames.notificationsContent,
        'the mutation must reload only the notifications-content frame',
      )
    } finally {
      await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId])
    }
  })
})
