import { before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from './db.ts'
import { router } from './test-router.ts'
import { routes } from './routes.ts'
import { createAuthCookieWithCsrfForUser } from '../test/utils.ts'

const BASE = 'https://remix.run'

/**
 * Guide ch. 8 §"Parse query strings and repeated fields": query and form
 * values are untrusted. A finite number is not a safe integer — `Number('1e30')`
 * and `Number('1.5')` both reach SQL as a bigint OFFSET / int4 id and turn the
 * page into a 500. These cases pin the shared parsers at the real router.
 */
describe('untrusted grid inputs', () => {
  let adminCookie = ''
  let csrfToken = ''

  before(async () => {
    await initializeAppDatabase()
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!auth?.cookie) throw new Error('Failed to create admin session')
    adminCookie = auth.cookie
    csrfToken = auth.csrfToken
  })

  function get(path: string): Promise<Response> {
    return router.fetch(BASE + path, { headers: { Cookie: adminCookie } })
  }

  function formPost(path: string, fields: Record<string, string>): Promise<Response> {
    return router.fetch(BASE + path, {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: BASE,
      },
      body: new URLSearchParams({ _csrf: csrfToken, ...fields }),
    })
  }

  it('renders every grid with an out-of-range offset instead of 500ing', async () => {
    let paths = [
      routes.admin.clients.index.href(),
      routes.admin.messages.index.href(),
      routes.admin.lists.index.href(),
      routes.admin.webhookRequests.index.href(),
      routes.lists.index.href(),
      routes.notifications.index.href(),
      routes.appointmentsNew.index.href(),
      routes.verwaltung.appointments.index.href(),
      routes.verwaltung.offerings.index.href(),
      routes.verwaltung.resources.index.href(),
      routes.verwaltung.offeringConfigs.index.href(),
      routes.verwaltung.report1.index.href(),
    ]

    for (let path of paths) {
      let response = await get(`${path}${path.includes('?') ? '&' : '?'}offset=1e30`)
      assert.equal(response.status, 200, `${path} must render, not 500`)
    }
  })

  it('ignores fractional editing/deleting ids instead of 500ing', async () => {
    let paths = [
      routes.admin.users.index.href(),
      routes.verwaltung.appointments.index.href(),
      routes.verwaltung.offerings.index.href(),
      routes.verwaltung.resources.index.href(),
      routes.verwaltung.offeringConfigs.index.href(),
    ]

    for (let path of paths) {
      let response = await get(`${path}?editing=1.5`)
      assert.equal(response.status, 200, `${path} must render, not 500`)
    }

    let deleting = await get(`${routes.appointmentsNew.index.href()}?deleting=1.5`)
    assert.equal(deleting.status, 200, 'appointments/new must ignore a fractional deleting id')

    let report = await get(`${routes.verwaltung.report1.index.href()}?user_id=1.5`)
    assert.equal(report.status, 200, 'report1 must ignore a fractional user_id')
  })

  it('rejects whitespace-only required text before the table hook rejects the write', async () => {
    let users = await formPost(routes.admin.users.index.href(), {
      name: '   ',
      email: `whitespace-${Date.now()}@example.com`,
      role: 'customer',
      password: 'Str0ng!Passw0rd',
      _offset: '1e30',
    })
    assert.equal(users.status, 400, 'admin user create must re-render, not 500')

    let lists = await formPost(routes.admin.lists.index.href(), {
      title: '   ',
      description: 'A valid description',
      _offset: '1e30',
    })
    assert.equal(lists.status, 400, 'admin list create must reject a whitespace title')

    let resources = await formPost(routes.verwaltung.resources.index.href(), {
      name: '    ',
      description: 'A valid description',
      capabilities: '',
      _offset: '1e30',
    })
    assert.equal(resources.status, 400, 'resource create must reject a whitespace name')
  })

  it('rejects a whitespace-only appointment title', async () => {
    let response = await router.fetch(BASE + routes.appointment.index.href(), {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/json',
        Origin: BASE,
        'X-Csrf-Token': csrfToken,
      },
      body: JSON.stringify({
        title: '   ',
        date: Date.now() + 86_400_000,
        start_min: 600,
        end_min: 660,
        resource_id: 1,
      }),
    })
    assert.equal(response.status, 400, 'appointment create must reject a whitespace title')
  })

  it('rejects a whitespace-only registration name', async () => {
    let response = await formPost(routes.auth.register.index.href(), {
      name: '        ',
      email: `register-${Date.now()}@example.com`,
      password: 'Str0ng!Passw0rd',
      confirmPassword: 'Str0ng!Passw0rd',
    })
    assert.equal(response.status, 400, 'register must reject a whitespace name')
  })

  it('rejects an exponential list id on the JSON API instead of 500ing', async () => {
    let response = await router.fetch(BASE + '/lists/1e30', {
      method: 'PUT',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/json',
        Origin: BASE,
        'X-Csrf-Token': csrfToken,
      },
      body: JSON.stringify({ title: 'x' }),
    })
    assert.equal(response.status, 400, 'an exponential list id is a client error')
  })

  it('drops fractional bulk upload ids instead of sending them to int4 SQL', async () => {
    let download = await formPost(routes.admin.uploads.downloadMany.href(), { ids: '1.5' })
    assert.equal(download.status, 400, 'no valid ids means no download')

    let destroy = await formPost(routes.admin.uploads.destroyMany.href(), { ids: '1.5' })
    assert.equal(destroy.status, 303, 'a no-op bulk delete still redirects')
  })
})
