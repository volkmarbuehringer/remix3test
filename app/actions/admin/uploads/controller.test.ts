import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { MaxFileSizeExceededError } from 'remix/form-data-parser'

import { db, initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../data/test-pool.ts'
import { insertUpload, claimUploads } from '../../../data/uploads.ts'
import { uploadLimitErrorCode } from '../../../middleware/uploads.ts'
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
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-%'")
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

  it('POST /admin/uploads with a disallowed file type renders a friendly rejection', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append(
      'file',
      new File([Buffer.from('x')], 'bad.exe', { type: 'application/x-msdownload' }),
    )

    let response = await router.fetch(UPLOADS_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    // The handler declines the file without throwing, so the request completes
    // with the banner rather than being killed by an uncaught exception.
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Dateityp nicht erlaubt'), 'should explain why the file was rejected')
    let result = await pool.query("SELECT COUNT(*) AS c FROM uploads WHERE filename = 'bad.exe'")
    assert.equal(Number(result.rows[0].c), 0, 'rejected file should not be stored')
  })

  it('GET /admin/uploads?uploadError=file_too_large renders the size message', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let response = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?uploadError=file_too_large`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Eine Datei überschreitet die maximale Größe von 50 MB.'))
  })

  it('GET /admin/uploads paginates when there are many uploads', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let ids: number[] = []
    for (let i = 1; i <= 25; i++) {
      let id = await insertUpload(db, {
        filename: `test-page-${i}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      })
      ids.push(Number(id))
    }
    let claimed = await claimUploads(db, ids, userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test uploads')

    let page1 = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}?page=1`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(page1.status, 200)
    let html1 = await page1.text()
    assert.ok(html1.includes('Seite 1 von 2'), 'page 1 should be the first of two pages')
    assert.ok(html1.includes('test-page-25.txt'), 'newest upload should be on page 1')
    assert.ok(!html1.includes('test-page-1.txt'), 'oldest upload should be on page 2')

    let page2 = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}?page=2`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(page2.status, 200)
    let html2 = await page2.text()
    assert.ok(html2.includes('Seite 2 von 2'), 'page 2 should be the second page')
    assert.ok(html2.includes('test-page-1.txt'), 'oldest upload should appear on page 2')
    assert.ok(html2.includes('Zurück'), 'page 2 should offer a back link')
  })

  it('uploadLimitErrorCode maps parser limit errors to stable codes', async () => {
    assert.equal(uploadLimitErrorCode(new MaxFileSizeExceededError(1)), 'file_too_large')
    assert.equal(uploadLimitErrorCode(new Error('nope')), null)
  })
})
