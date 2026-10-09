import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { readSessionId, sessionStorage } from '../../middleware/session.ts'
import { routes } from '../../routes.ts'

const BASE = 'https://remix.run'

describe('Admin page-size preference', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  async function freshAdmin() {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!auth?.cookie) throw new Error('failed to create admin session')
    return auth
  }

  function pageSizePost(auth: { cookie: string; csrfToken: string }, body: Record<string, string>) {
    return router.fetch(`${BASE}${routes.admin.pageSize.href()}`, {
      method: 'POST',
      headers: { Cookie: auth.cookie },
      body: new URLSearchParams({ _csrf: auth.csrfToken, ...body }),
      redirect: 'manual',
    })
  }

  it('saves an admin grid override and returns with offset dropped', async () => {
    let auth = await freshAdmin()

    let response = await pageSizePost(auth, {
      _action: 'page-size',
      pageKey: 'admin.users',
      pageSize: '25',
      returnTo: '/admin/users?sort=name&order=asc&offset=30',
    })

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get('Location'),
      '/admin/users?sort=name&order=asc',
      'changing the page size must drop the stale offset',
    )

    let sid = await readSessionId(auth.cookie)
    let session = await sessionStorage.read(sid)
    assert.deepEqual(session?.get('pageSizes'), { 'admin.users': 25 })
  })

  it('drops the uploads page param as well as offset', async () => {
    let auth = await freshAdmin()

    let response = await pageSizePost(auth, {
      _action: 'page-size',
      pageKey: 'admin.uploads',
      pageSize: '30',
      returnTo: '/admin/uploads?page=4&sort=created_at&order=desc',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/admin/uploads?sort=created_at&order=desc')
  })

  it('reset clears the override', async () => {
    let auth = await freshAdmin()
    await pageSizePost(auth, {
      _action: 'page-size',
      pageKey: 'admin.messages',
      pageSize: '25',
      returnTo: '/admin/messages',
    })

    let response = await pageSizePost(auth, {
      _action: 'reset-page-size',
      pageKey: 'admin.messages',
      returnTo: '/admin/messages',
    })
    assert.equal(response.status, 302)

    let sid = await readSessionId(auth.cookie)
    let session = await sessionStorage.read(sid)
    assert.deepEqual(session?.get('pageSizes'), {}, 'reset removes the page entry')
  })

  it('refuses a returnTo outside /admin', async () => {
    let auth = await freshAdmin()

    let response = await pageSizePost(auth, {
      _action: 'page-size',
      pageKey: 'admin.users',
      pageSize: '25',
      returnTo: 'https://evil.example/steal',
    })

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get('Location'),
      routes.admin.index.href(),
      'an off-site returnTo falls back to the admin dashboard',
    )
  })

  it('ignores an unknown page key', async () => {
    let auth = await freshAdmin()

    let response = await pageSizePost(auth, {
      _action: 'page-size',
      pageKey: 'not.a.page',
      pageSize: '25',
      returnTo: '/admin/users',
    })
    assert.equal(response.status, 302)

    let sid = await readSessionId(auth.cookie)
    let session = await sessionStorage.read(sid)
    assert.equal(session?.get('pageSizes'), undefined, 'unknown keys are not stored')
  })

  it('renders the page-size control on every paginated admin grid', async () => {
    let auth = await freshAdmin()

    // /admin/lists and /admin/webhook-requests have no seed rows; insert one of
    // each so their pagination footers (which only render when there are rows)
    // expose the control.
    let inserted = await pool.query(
      `INSERT INTO lists (title, description, list, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING id`,
      ['Seitenzahl-Test', '', '[]', Date.now(), Date.now()],
    )
    let listId = inserted.rows[0]?.id
    let webhookId = crypto.randomUUID()
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
       VALUES ($1, $2::jsonb, $3::jsonb, 'page-size-test', $4)`,
      [webhookId, '{}', '{}', Date.now()],
    )

    // /admin/chatlog is empty without Mastra memory, so force a non-zero offset
    // to render its pagination footer. /admin/uploads always renders its footer.
    let paths = [
      '/admin/users',
      '/admin/lists',
      '/admin/messages',
      '/admin/clients',
      '/admin/uploads',
      '/admin/webhook-requests',
      '/admin/chatlog?offset=10',
    ]

    try {
      for (let path of paths) {
        let response = await router.fetch(`${BASE}${path}`, {
          headers: { Cookie: auth.cookie },
        })
        assert.equal(response.status, 200, `${path} should render`)
        let html = await response.text()
        assert.ok(
          html.includes('data-page-size-control="true"'),
          `${path} should render the page-size slider`,
        )
        assert.ok(
          html.includes(`action="${routes.admin.pageSize.href()}"`),
          `${path} should post the slider to /admin/page-size`,
        )
      }
    } finally {
      if (listId !== undefined) {
        await pool.query('DELETE FROM lists WHERE id = $1', [listId])
      }
      await pool.query('DELETE FROM webhook_requests WHERE id = $1', [webhookId])
    }
  })
})
