import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { createSession } from 'remix/session'
import { MaxFileSizeExceededError } from 'remix/form-data-parser'

import { db, initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../data/test-pool.ts'
import { insertUpload, claimUploads } from '../../../data/uploads.ts'
import { uploadLimitErrorCode } from '../../../middleware/uploads.ts'
import { sessionCookie, sessionStorage } from '../../../middleware/session.ts'
import { router } from '../../../test-router.ts'
import { createAuthCookieWithCsrfForUser, generateCsrfToken } from '../../../test-utils.ts'
import { routes } from '../../../routes.ts'

const BASE = 'https://remix.run'
const UPLOADS_URL = `${BASE}${routes.admin.uploads.action.href()}`

/**
 * Build an authenticated session cookie with a custom `pageSize` override so
 * tests can assert that the uploads grid honors the session-configured page
 * size.
 */
async function authCookieForUserWithPageSize(
  email: string,
  pageSize: number,
): Promise<{ cookie: string; csrfToken: string } | null> {
  try {
    let result = await db.exec('SELECT id, token_version FROM users WHERE email = $1', [email])
    let rows = (result.rows ?? []) as { id: number; token_version: number }[]
    if (rows.length === 0) return null
    let user = rows[0]!
    let csrfToken = generateCsrfToken()
    let session = createSession<{ auth: { userId: number; tv: number }; pageSize: number }>()
    session.set('auth', { userId: user.id, tv: user.token_version ?? 1 })
    session.set('pageSize', pageSize)
    let sid = await sessionStorage.save(session)
    if (!sid) return null
    let setCookieValue = await sessionCookie.serialize(sid)
    let match = setCookieValue.match(/session=([^;]+)/)
    if (!match) return null
    return { cookie: `session=${match[1]}`, csrfToken }
  } catch {
    return null
  }
}

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
    assert.ok(html1.includes('test-page-11.txt'), '15th newest should close out page 1')
    assert.ok(!html1.includes('test-page-10.txt'), '16th newest should be on page 2')

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

  it('GET /admin/uploads honors the session-configured page size', async () => {
    let session = await authCookieForUserWithPageSize('user@newapp.com', 10)
    if (!session) throw new Error('Could not create auth session with pageSize')

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

    let response = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}?page=1`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    // 25 uploads at a configured page size of 10 → three pages, and page 1
    // holds only the newest ten (not the default page size of 20).
    assert.ok(html.includes('Seite 1 von 3'), 'pageSize 10 should yield 3 pages')
    assert.ok(html.includes('test-page-25.txt'), 'newest upload should be on page 1')
    assert.ok(html.includes('test-page-16.txt'), '10th newest should close out page 1')
    assert.ok(!html.includes('test-page-15.txt'), '11th newest should be on page 2')
  })

  it('GET /admin/uploads sorts by the requested column and direction', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let ids: number[] = []
    for (let i = 1; i <= 3; i++) {
      let id = await insertUpload(db, {
        filename: `test-sort-${i}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      })
      ids.push(Number(id))
    }
    let claimed = await claimUploads(db, ids, userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test uploads')

    // Default (no sort params): newest-first, so test-sort-3 renders before
    // test-sort-1.
    let defPage = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(defPage.status, 200)
    let defHtml = await defPage.text()
    assert.ok(
      defHtml.indexOf('test-sort-3.txt') < defHtml.indexOf('test-sort-1.txt'),
      'default order should be newest-first',
    )

    // filename ASC: test-sort-1 must render before test-sort-3.
    let ascPage = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?sort=filename&order=asc&page=1`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(ascPage.status, 200)
    let ascHtml = await ascPage.text()
    assert.ok(
      ascHtml.indexOf('test-sort-1.txt') < ascHtml.indexOf('test-sort-3.txt'),
      'filename ascending should put test-sort-1 first',
    )

    // filename DESC: test-sort-3 must render before test-sort-1.
    let descPage = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?sort=filename&order=desc&page=1`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(descPage.status, 200)
    let descHtml = await descPage.text()
    assert.ok(
      descHtml.indexOf('test-sort-3.txt') < descHtml.indexOf('test-sort-1.txt'),
      'filename descending should put test-sort-3 first',
    )
  })

  it('GET /admin/uploads filters by the search term', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let ids: number[] = []
    for (let i = 1; i <= 3; i++) {
      let id = await insertUpload(db, {
        filename: `test-filt-${i}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      })
      ids.push(Number(id))
    }
    let claimed = await claimUploads(db, ids, userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test uploads')

    let response = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?filter=test-filt-2&sort=created_at&order=desc&page=1`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('test-filt-2.txt'), 'matching upload should appear')
    assert.ok(!html.includes('test-filt-1.txt'), 'non-matching upload should be excluded')
    assert.ok(!html.includes('test-filt-3.txt'), 'non-matching upload should be excluded')
    assert.ok(html.includes('durchsuchen'), 'filter box should render the durchsuchen input')
  })

  it('GET /admin/uploads shows a no-match message when the filter finds nothing', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let response = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?filter=zzz-no-such-upload`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Keine Dateien gefunden für diese Suche.'),
      'filtered empty state should be shown',
    )
  })

  it('GET /admin/uploads renders a delete button and context-menu trigger per row', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let id = Number(
      await insertUpload(db, {
        filename: 'test-del-button.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    let claimed = await claimUploads(db, [id], userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test upload')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes(`data-delete-form="${id}"`), 'row should have a delete form')
    assert.ok(html.includes('data-download-link'), 'row should have a download icon button')
    assert.ok(html.includes('Aktionen'), 'actions column should be labelled')
    assert.ok(html.includes('data-uploads-table'), 'context menu should target the uploads table')
    assert.ok(html.includes('data-row-id'), 'rows should expose a row-id for the context menu')
  })

  it('POST /admin/uploads/:id/delete deletes the upload the user claimed and redirects', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let id = Number(
      await insertUpload(db, {
        filename: 'test-del-owner.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    let claimed = await claimUploads(db, [id], userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test upload')

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.set('_page', '2')
    formData.set('_sort', 'created_at')
    formData.set('_order', 'desc')
    formData.set('_filter', 'test-del-owner')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.destroy.href({ id })}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(
      location?.startsWith(routes.admin.uploads.index.href()),
      'should redirect back to the uploads list',
    )
    assert.ok(location?.includes('page=2'), 'redirect should preserve the grid page')
    assert.ok(
      location?.includes('filter=test-del-owner'),
      'redirect should preserve the grid filter',
    )

    let result = await pool.query('SELECT COUNT(*) AS c FROM uploads WHERE id = $1', [id])
    assert.equal(Number(result.rows[0].c), 0, 'upload should be deleted')
  })

  it("POST /admin/uploads/:id/delete leaves another user's upload untouched", async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    // A second non-admin user whose upload the authenticated user must not be
    // able to delete (ownership scoping on the destroy write path).
    let otherRow = await db.exec(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ('other@newapp.com', 'x', 'Other', 'customer', 1, 1, $1, $1)
       ON CONFLICT (email) DO UPDATE SET name = 'Other' RETURNING id`,
      [Date.now()],
    )
    let otherId = Number((otherRow.rows?.[0] as { id: number } | undefined)?.id)

    let id = Number(
      await insertUpload(db, {
        filename: 'test-del-other.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    await pool.query('UPDATE uploads SET uploaded_by = $1 WHERE id = $2', [otherId, id])

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.set('_page', '1')
    formData.set('_sort', 'created_at')
    formData.set('_order', 'desc')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.destroy.href({ id })}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    assert.ok(
      (response.headers.get('Location') ?? '').startsWith(routes.admin.uploads.index.href()),
      'delete should still redirect to the uploads list',
    )

    let result = await pool.query('SELECT COUNT(*) AS c FROM uploads WHERE id = $1', [id])
    assert.equal(Number(result.rows[0].c), 1, "another user's upload must not be deleted")
  })

  it('GET /admin/uploads/:id/delete (destroyResolve) renders the uploads list', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let id = Number(
      await insertUpload(db, {
        filename: 'test-del-resolve.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    let claimed = await claimUploads(db, [id], userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test upload')

    let response = await router.fetch(
      `${BASE}${routes.admin.uploads.destroyResolve.href({ id })}`,
      {
        headers: { Cookie: session.cookie },
      },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Datei-Upload'), 'resolver should render the uploads page')
  })

  it('GET /admin/uploads renders the multirow selection controls', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let id = Number(
      await insertUpload(db, {
        filename: 'test-bulk-ui.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    let claimed = await claimUploads(db, [id], userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test upload')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes(`name="ids" value="${id}"`),
      'row should expose a named ids checkbox',
    )
    assert.ok(html.includes('data-select-all'), 'header should expose a select-all toggle')
    assert.ok(html.includes('Ausgewählte löschen'), 'page should render the bulk delete button')
    assert.ok(html.includes('data-bulk-delete-form'), 'bulk form should carry its marker')
    assert.ok(
      html.includes(routes.admin.uploads.destroyMany.href()),
      'bulk form should target the destroy-many action',
    )
  })

  it('POST /admin/uploads/delete-many deletes the selected rows and redirects with a deleted banner', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let ids: number[] = []
    for (let i = 1; i <= 2; i++) {
      let id = Number(
        await insertUpload(db, {
          filename: `test-bulk-del-${i}.txt`,
          mimeType: 'text/plain',
          buffer: Buffer.from('x'),
          size: 1,
          now: Date.now(),
        }),
      )
      ids.push(id)
    }
    let claimed = await claimUploads(db, ids, userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test uploads')

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    for (let id of ids) formData.append('ids', String(id))
    formData.set('_page', '2')
    formData.set('_sort', 'created_at')
    formData.set('_order', 'desc')
    formData.set('_filter', 'test-bulk-del')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.destroyMany.href()}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(routes.admin.uploads.index.href()), 'should redirect to uploads')
    assert.ok(location.includes('page=2'), 'redirect should preserve the grid page')
    assert.ok(location.includes('filter=test-bulk-del'), 'redirect should preserve the grid filter')
    assert.ok(location.includes('deleted=2'), 'redirect should carry the deleted count')

    let result = await pool.query('SELECT id FROM uploads WHERE id = ANY($1)', [ids])
    assert.equal(result.rows.length, 0, 'selected uploads should be deleted')
  })

  it("POST /admin/uploads/delete-many leaves another user's upload untouched", async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let otherRow = await db.exec(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ('other2@newapp.com', 'x', 'Other', 'customer', 1, 1, $1, $1)
       ON CONFLICT (email) DO UPDATE SET name = 'Other' RETURNING id`,
      [Date.now()],
    )
    let otherId = Number((otherRow.rows?.[0] as { id: number } | undefined)?.id)

    let owned = Number(
      await insertUpload(db, {
        filename: 'test-bulk-own.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    await claimUploads(db, [owned], userId, Number.MAX_SAFE_INTEGER)

    let other = Number(
      await insertUpload(db, {
        filename: 'test-bulk-other.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    await pool.query('UPDATE uploads SET uploaded_by = $1 WHERE id = $2', [otherId, other])

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append('ids', String(owned))
    formData.append('ids', String(other))
    formData.set('_page', '1')
    formData.set('_sort', 'created_at')
    formData.set('_order', 'desc')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.destroyMany.href()}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.ok(
      (response.headers.get('Location') ?? '').startsWith(routes.admin.uploads.index.href()),
      'bulk delete should still redirect to the uploads list',
    )

    let ownResult = await pool.query('SELECT COUNT(*) AS c FROM uploads WHERE id = $1', [owned])
    assert.equal(Number(ownResult.rows[0].c), 0, 'owned upload should be deleted')
    let otherResult = await pool.query('SELECT COUNT(*) AS c FROM uploads WHERE id = $1', [other])
    assert.equal(Number(otherResult.rows[0].c), 1, "another user's upload must not be deleted")
  })

  it('POST /admin/uploads/delete-many with no valid ids is a no-op that still redirects', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let id = Number(
      await insertUpload(db, {
        filename: 'test-bulk-nop.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    await claimUploads(db, [id], userId, Number.MAX_SAFE_INTEGER)

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.set('_page', '1')
    formData.set('_sort', 'created_at')
    formData.set('_order', 'desc')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.destroyMany.href()}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(routes.admin.uploads.index.href()), 'should redirect to uploads')
    assert.ok(!location.includes('deleted='), 'no deleted count when nothing was deleted')

    let result = await pool.query('SELECT COUNT(*) AS c FROM uploads WHERE id = $1', [id])
    assert.equal(Number(result.rows[0].c), 1, 'nothing should be deleted')
  })

  it('GET /admin/uploads/delete-many (destroyManyResolve) renders the uploads page', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let response = await router.fetch(
      `${BASE}${routes.admin.uploads.destroyManyResolve.href()}`,
      {
        headers: { Cookie: session.cookie },
      },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Datei-Upload'), 'resolver should render the uploads page')
  })

  it('GET /admin/uploads?deleted=3 renders the deleted banner', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let response = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?deleted=3`,
      {
        headers: { Cookie: session.cookie },
      },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('3 Dateien gelöscht.'), 'should render the deleted banner')
  })
})
