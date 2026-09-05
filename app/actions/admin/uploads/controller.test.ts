import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../data/test-pool.ts'
import { router } from '../../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { routes } from '../../../routes.ts'

const BASE = 'https://remix.run'
const UPLOADS_URL = `${BASE}${routes.admin.uploads.action.href()}`

describe('Admin Uploads controller', () => {
  let userId: number

  before(async () => {
    await initializeAppDatabase()
    let result = await db.exec('SELECT id FROM users WHERE email = $1', ['user@newapp.com'])
    let rows = (result.rows ?? []) as { id: number }[]
    if (rows.length === 0) throw new Error('Expected seeded user@newapp.com to exist')
    userId = rows[0]!.id
  })

  afterEach(async () => {
    // Remove upload rows created by this suite so runs stay independent. The
    // upload middleware inserts rows with uploaded_by = NULL; claiming assigns
    // them to the test user.
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-multi-%'")
  })

  it('GET /admin/uploads redirects unauthenticated users to login', async () => {
    let response = await router.fetch(UPLOADS_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login')
  })

  it('GET /admin/uploads renders the page with a multi-file input', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let response = await router.fetch(UPLOADS_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Datei-Upload'), 'page should contain the upload heading')
    assert.ok(html.includes('multiple'), 'file input should allow multiple files')
    assert.ok(html.includes('name="file"'), 'page should contain the file input')
  })

  it('POST /admin/uploads accepts multiple files in one request', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append(
      'file',
      new File([Buffer.from('alpha')], 'test-multi-a.txt', { type: 'text/plain' }),
    )
    formData.append(
      'file',
      new File([Buffer.from('beta')], 'test-multi-b.txt', { type: 'text/plain' }),
    )

    let response = await router.fetch(UPLOADS_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Dateien hochgeladen (IDs:'),
      'success banner should report multiple files',
    )
    assert.ok(html.includes('test-multi-a.txt'), 'uploaded file a should appear in the list')
    assert.ok(html.includes('test-multi-b.txt'), 'uploaded file b should appear in the list')

    // Both rows must be claimed by the authenticated user.
    let result = await pool.query(
      'SELECT filename, uploaded_by FROM uploads WHERE filename LIKE $1',
      ['test-multi-%'],
    )
    let rows = result.rows as { filename: string; uploaded_by: number }[]
    assert.equal(rows.length, 2, 'both files should be stored')
    for (let row of rows) {
      assert.equal(row.uploaded_by, userId, 'each file should be claimed by the uploader')
    }
  })

  it('POST /admin/uploads without a file reports an upload failure', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)

    let response = await router.fetch(UPLOADS_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Upload fehlgeschlagen'),
      'should surface the failure banner when no usable file is uploaded',
    )
  })
})
