import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser, createTestUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'

const BASE = 'https://remix.run'

interface FreshUser {
  id: number
  email: string
}

async function createFreshUser(): Promise<FreshUser> {
  let email = `notif-ctrl-${Date.now()}-${Math.random()}@example.com`
  let id = await createTestUser(email)
  if (id == null) throw new Error('Could not create test user')
  return { id, email }
}

async function getSessionFor(email: string) {
  let session = await createAuthCookieWithCsrfForUser(email)
  if (!session) throw new Error('Could not create auth session')
  return session
}

async function createNotificationFor(userId: number, type: string): Promise<number> {
  let r = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, appointment_id, read_at, created_at)
     VALUES ($1, $2, $3, $4, NULL, NULL, $5) RETURNING id`,
    [userId, type, 'Titel', 'Inhalt', Date.now()],
  )
  return r.rows[0].id as number
}

describe('Notifications controller', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('GET /notifications returns the inbox for an authenticated user', async () => {
    let { id, email } = await createFreshUser()
    await createNotificationFor(id, 'confirmation')
    let session = await getSessionFor(email)

    let response = await router.fetch(`${BASE}${routes.notifications.index.href()}`, {
      headers: { Cookie: session.cookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Benachrichtigungen'), 'page should contain the inbox heading')
    assert.ok(html.includes('data-notifications-list'), 'page should render the list container')
    assert.ok(html.includes('Bestätigung'), 'page should render the notification type badge')
  })

  it('GET /notifications redirects unauthenticated users to login', async () => {
    let response = await router.fetch(`${BASE}${routes.notifications.index.href()}`, {
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(routes.auth.login.index.href()), 'should redirect to login')
  })

  it('GET /notifications/events streams SSE for an authenticated user', async () => {
    let { email } = await createFreshUser()
    let session = await getSessionFor(email)

    let response = await router.fetch(`${BASE}${routes.notifications.events.href()}`, {
      headers: { Cookie: session.cookie },
    })

    assert.equal(response.status, 200)
    assert.ok(
      (response.headers.get('Content-Type') ?? '').includes('text/event-stream'),
      'should return an SSE stream',
    )
    await response.body?.cancel()
  })

  it('GET /notifications/unread-count returns the current unread count', async () => {
    let { id, email } = await createFreshUser()
    let notifId = await createNotificationFor(id, 'confirmation')
    let session = await getSessionFor(email)

    let response = await router.fetch(`${BASE}${routes.notifications.unreadCount.href()}`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let body = (await response.json()) as { count: number }
    assert.ok(body.count >= 1, 'should report at least the unread notification')

    await pool.query('DELETE FROM notifications WHERE id = $1', [notifId])
  })

  it('POST /notifications/:id/read marks an owned notification read', async () => {
    let { id, email } = await createFreshUser()
    let notifId = await createNotificationFor(id, 'reminder')
    let session = await getSessionFor(email)

    let response = await router.fetch(`${BASE}${routes.notifications.markRead.href({ id: notifId })}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ _csrf: session.csrfToken, _action: 'mark-read' }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let rows = await pool.query('SELECT read_at FROM notifications WHERE id = $1', [notifId])
    assert.notEqual(rows.rows[0].read_at, null, 'owned notification should be marked read')

    await pool.query('DELETE FROM notifications WHERE id = $1', [notifId])
  })

  it('POST /notifications/:id/read cannot mark another user’s notification read (cross-user)', async () => {
    let owner = await createFreshUser()
    let attacker = await createFreshUser()
    let notifId = await createNotificationFor(owner.id, 'confirmation')
    let session = await getSessionFor(attacker.email)

    let response = await router.fetch(`${BASE}${routes.notifications.markRead.href({ id: notifId })}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ _csrf: session.csrfToken, _action: 'mark-read' }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let rows = await pool.query('SELECT read_at FROM notifications WHERE id = $1', [notifId])
    assert.equal(rows.rows[0].read_at, null, 'another user must not be able to mark it read')

    await pool.query('DELETE FROM notifications WHERE id = $1', [notifId])
  })

  it('POST /notifications/mark-all-read marks all unread notifications read', async () => {
    let { id, email } = await createFreshUser()
    let id1 = await createNotificationFor(id, 'reminder')
    let id2 = await createNotificationFor(id, 'cancellation')
    let session = await getSessionFor(email)

    let response = await router.fetch(`${BASE}${routes.notifications.markAllRead.href()}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ _csrf: session.csrfToken, _action: 'mark-all-read' }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let rows = await pool.query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [id],
    )
    assert.equal(rows.rows[0].n, 0, 'all unread notifications should be cleared')

    await pool.query('DELETE FROM notifications WHERE id = ANY($1)', [[id1, id2]])
  })
})
