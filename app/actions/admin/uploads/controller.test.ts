import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { createSession } from 'remix/session'
import { MaxFileSizeExceededError } from 'remix/form-data-parser'
import { ContentDisposition } from 'remix/headers'

import { db, initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../../test/pool.ts'
import { insertUpload, claimUploads } from '../../../data/uploads.ts'
import { uploadLimitErrorCode } from '../../../middleware/uploads.ts'
import { serializeSessionCookie, sessionStorage } from '../../../middleware/session.ts'
import { router } from '../../../test-router.ts'
import { createAuthCookieWithCsrfForUser, generateCsrfToken } from '../../../../test/utils.ts'
import { routes } from '../../../routes.ts'
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  formatBytes,
} from '../../../utils/upload-validation.ts'

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
    let setCookieValue = await serializeSessionCookie(sid)
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
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'uplctl-%'")
  })

  it('GET /admin/uploads redirects unauthenticated users to login', async () => {
    let response = await router.fetch(UPLOADS_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login')
  })

  it('POST /admin/uploads rejects an unauthenticated multipart upload before parsing', async () => {
    let formData = new FormData()
    formData.append(
      'file',
      new File([Buffer.from('nope')], 'uplctl-unauth.txt', { type: 'text/plain' }),
    )

    let response = await router.fetch(UPLOADS_URL, { method: 'POST', body: formData })

    assert.equal(response.status, 401, 'unauthenticated multipart must fail before formData()')
    let result = await pool.query(
      "SELECT COUNT(*) AS c FROM uploads WHERE filename = 'uplctl-unauth.txt'",
    )
    assert.equal(Number(result.rows[0].c), 0, 'the rejected upload must not reach storage')
  })

  it('rejects a cross-origin authenticated upload before parsing', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let formData = new FormData()
    formData.append(
      'file',
      new File([Buffer.from('nope')], 'uplctl-cross-origin.txt', { type: 'text/plain' }),
    )

    let response = await router.fetch(UPLOADS_URL, {
      method: 'POST',
      headers: {
        Cookie: session.cookie,
        Origin: 'https://evil.example',
        'Sec-Fetch-Site': 'cross-site',
      },
      body: formData,
    })

    assert.equal(response.status, 403, 'cross-origin uploads must fail before formData()')
    let result = await pool.query(
      "SELECT COUNT(*) AS c FROM uploads WHERE filename = 'uplctl-cross-origin.txt'",
    )
    assert.equal(Number(result.rows[0].c), 0, 'the rejected upload must not reach storage')
  })

  it('does not store files from multipart bodies posted to non-upload actions', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let formData = new FormData()
    formData.append(
      'file',
      new File([Buffer.from('nope')], 'uplctl-wrong-path.txt', { type: 'text/plain' }),
    )

    let response = await router.fetch(`${BASE}/`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    // The request may 404/405 because `/` has no POST route; the invariant is
    // that a multipart body outside the uploads action never reaches storage.
    assert.notEqual(response.status, 401, 'an authenticated session may still parse forms')
    let result = await pool.query(
      "SELECT COUNT(*) AS c FROM uploads WHERE filename = 'uplctl-wrong-path.txt'",
    )
    assert.equal(Number(result.rows[0].c), 0, 'the upload must not reach storage')
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
    assert.ok(
      html.includes(`accept="${[...ALLOWED_EXTENSIONS].join(',')}"`),
      'file input should suggest the allowed extensions',
    )
    assert.ok(
      html.includes(`maximal ${formatBytes(MAX_UPLOAD_BYTES)} pro Datei`),
      'the dropzone should state the size and count policy up front',
    )
    assert.ok(
      html.includes('data-pending-summary'),
      'the selected-files summary should be rendered',
    )
    assert.ok(
      html.includes('data-mobile-sort'),
      'phones need a sort control because the sortable headers are hidden',
    )
  })

  it('POST /admin/uploads accepts multiple files in one request', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append(
      'file',
      new File([Buffer.from('alpha')], 'uplctl-multi-a.txt', { type: 'text/plain' }),
    )
    formData.append(
      'file',
      new File([Buffer.from('beta')], 'uplctl-multi-b.txt', { type: 'text/plain' }),
    )

    let response = await router.fetch(UPLOADS_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('2 Dateien erfolgreich hochgeladen.'),
      'success banner should report the number of uploaded files',
    )
    assert.ok(html.includes('uplctl-multi-a.txt'), 'uploaded file a should appear in the list')
    assert.ok(html.includes('uplctl-multi-b.txt'), 'uploaded file b should appear in the list')
    // Scope to the row tags: the rendered stylesheet also contains the
    // `[data-uploaded="true"]` selector, so a page-wide string count would
    // include CSS rules.
    for (let name of ['uplctl-multi-a.txt', 'uplctl-multi-b.txt']) {
      let rowTag = html.match(new RegExp(`<tr[^>]*data-upload-filename="${name}"[^>]*>`))?.[0] ?? ''
      assert.ok(rowTag.includes('data-uploaded="true"'), `${name} should be highlighted`)
    }

    // Both rows must be claimed by the authenticated user.
    let result = await pool.query(
      'SELECT filename, uploaded_by FROM uploads WHERE filename LIKE $1',
      ['uplctl-multi-%'],
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
        filename: `uplctl-page-${i}.txt`,
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
    assert.ok(html1.includes('uplctl-page-25.txt'), 'newest upload should be on page 1')
    assert.ok(html1.includes('uplctl-page-11.txt'), '15th newest should close out page 1')
    assert.ok(!html1.includes('uplctl-page-10.txt'), '16th newest should be on page 2')

    let page2 = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}?page=2`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(page2.status, 200)
    let html2 = await page2.text()
    assert.ok(html2.includes('Seite 2 von 2'), 'page 2 should be the second page')
    assert.ok(html2.includes('uplctl-page-1.txt'), 'oldest upload should appear on page 2')
    assert.ok(html2.includes('Zurück'), 'page 2 should offer a back link')
    assert.ok(
      html1.includes('aria-current="page"'),
      'the current page number should be announced as current',
    )
    assert.ok(html1.includes('aria-label="Seite 2"'), 'page numbers should link directly')
    assert.ok(
      html1.includes('aria-label="Nächste Seite"'),
      'the next-page link should not duplicate the page-number label',
    )
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
        filename: `uplctl-page-${i}.txt`,
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
    // Surface what was actually rendered (page size, total, page count) if
    // this ever regresses again.
    let footer = html.match(/\d+ Dateien · Seite \d+ von \d+/)?.[0] ?? '<no footer>'
    assert.ok(html.includes('Seite 1 von 3'), `pageSize 10 should yield 3 pages; saw: ${footer}`)
    assert.ok(html.includes('uplctl-page-25.txt'), 'newest upload should be on page 1')
    assert.ok(html.includes('uplctl-page-16.txt'), '10th newest should close out page 1')
    assert.ok(!html.includes('uplctl-page-15.txt'), '11th newest should be on page 2')
  })

  it('GET /admin/uploads sorts by the requested column and direction', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let ids: number[] = []
    for (let i = 1; i <= 3; i++) {
      let id = await insertUpload(db, {
        filename: `uplctl-sort-${i}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      })
      ids.push(Number(id))
    }
    let claimed = await claimUploads(db, ids, userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test uploads')

    // Default (no sort params): newest-first, so uplctl-sort-3 renders before
    // uplctl-sort-1.
    let defPage = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(defPage.status, 200)
    let defHtml = await defPage.text()
    assert.ok(
      defHtml.indexOf('uplctl-sort-3.txt') < defHtml.indexOf('uplctl-sort-1.txt'),
      'default order should be newest-first',
    )

    // filename ASC: uplctl-sort-1 must render before uplctl-sort-3.
    let ascPage = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?sort=filename&order=asc&page=1`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(ascPage.status, 200)
    let ascHtml = await ascPage.text()
    assert.ok(
      ascHtml.indexOf('uplctl-sort-1.txt') < ascHtml.indexOf('uplctl-sort-3.txt'),
      'filename ascending should put uplctl-sort-1 first',
    )

    // filename DESC: uplctl-sort-3 must render before uplctl-sort-1.
    let descPage = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?sort=filename&order=desc&page=1`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(descPage.status, 200)
    let descHtml = await descPage.text()
    assert.ok(
      descHtml.indexOf('uplctl-sort-3.txt') < descHtml.indexOf('uplctl-sort-1.txt'),
      'filename descending should put uplctl-sort-3 first',
    )
  })

  it('GET /admin/uploads filters by the search term', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let ids: number[] = []
    for (let i = 1; i <= 3; i++) {
      let id = await insertUpload(db, {
        filename: `uplctl-filt-${i}.txt`,
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
      `${BASE}${routes.admin.uploads.index.href()}?filter=uplctl-filt-2&sort=created_at&order=desc&page=1`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('uplctl-filt-2.txt'), 'matching upload should appear')
    assert.ok(!html.includes('uplctl-filt-1.txt'), 'non-matching upload should be excluded')
    assert.ok(!html.includes('uplctl-filt-3.txt'), 'non-matching upload should be excluded')
    assert.ok(
      html.includes('Suche nach Dateiname oder Typ'),
      'filter box should render the descriptive search input',
    )
    assert.ok(html.includes('data-kind-tabs'), 'filter box should render the kind tabs')
  })

  it('GET /admin/uploads shows per-kind counts scoped by the search', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let ids: number[] = []
    for (let [filename, mimeType] of [
      ['uplctl-counts-a.pdf', 'application/pdf'],
      ['uplctl-counts-b.txt', 'text/plain'],
    ] as [string, string][]) {
      let id = await insertUpload(db, {
        filename,
        mimeType,
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      })
      ids.push(Number(id))
    }
    let claimed = await claimUploads(db, ids, userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test uploads')

    let response = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?filter=uplctl-counts`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(response.status, 200)
    let html = await response.text()

    // Counts follow the active search, so the badges always describe what a
    // click on each tab would show.
    assert.ok(html.includes('aria-label="Alle: 2 Dateien"'), 'Alle should count both matches')
    assert.ok(html.includes('aria-label="PDF: 1 Datei"'), 'PDF should count its single match')
    assert.ok(html.includes('aria-label="Text: 1 Datei"'), 'Text should count its single match')
    assert.ok(html.includes('aria-label="Bilder: 0 Dateien"'), 'Bilder should show an empty tab')
  })

  it('GET /admin/uploads makes the filename a download link and labels row actions', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let id = Number(
      await insertUpload(db, {
        filename: 'uplctl-name-link.txt',
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

    let linkTag = html.match(/<a[^>]*data-filename-link[^>]*>/)?.[0] ?? ''
    assert.ok(linkTag, 'the filename should render as a link')
    assert.ok(linkTag.includes(`href="${routes.admin.uploads.download.href({ id })}"`))
    assert.ok(linkTag.includes('download'), 'the filename link should download the file')
    assert.ok(
      linkTag.includes('aria-label="uplctl-name-link.txt herunterladen"'),
      'the filename link should carry a descriptive label',
    )

    // Repeated per-row icon buttons need the filename in their labels, otherwise
    // a screen reader announces the same "Datei löschen" for every row.
    assert.ok(html.includes('aria-label="uplctl-name-link.txt herunterladen"'))
    assert.ok(html.includes('aria-label="uplctl-name-link.txt löschen"'))
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
    assert.ok(
      html.includes('Filter zurücksetzen'),
      'a filtered empty state should offer a way back to the full list',
    )
  })

  it('GET /admin/uploads?kind=pdf filters to PDF uploads', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let specs: [string, string][] = [
      ['uplctl-kind-doc.pdf', 'application/pdf'],
      ['uplctl-kind-note.txt', 'text/plain'],
      ['uplctl-kind-photo.png', 'image/png'],
    ]
    let ids: number[] = []
    for (let [filename, mimeType] of specs) {
      let id = await insertUpload(db, {
        filename,
        mimeType,
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      })
      ids.push(Number(id))
    }
    let claimed = await claimUploads(db, ids, userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test uploads')

    let response = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?kind=pdf&sort=created_at&order=desc&page=1`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('data-kind-tabs'), 'kind tabs should render')
    assert.ok(html.includes('uplctl-kind-doc.pdf'), 'the PDF should appear under the PDF tab')
    assert.ok(!html.includes('uplctl-kind-note.txt'), 'text uploads should be filtered out')
    assert.ok(!html.includes('uplctl-kind-photo.png'), 'image uploads should be filtered out')
  })

  it('GET /admin/uploads kind filter matches the image and text families', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let imageId = Number(
      await insertUpload(db, {
        filename: 'uplctl-kindfam-image.webp',
        mimeType: 'image/webp',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    let textId = Number(
      await insertUpload(db, {
        filename: 'uplctl-kindfam-data.json',
        mimeType: 'application/json',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    await claimUploads(db, [imageId, textId], userId, Number.MAX_SAFE_INTEGER)

    let imageResponse = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?kind=image`,
      { headers: { Cookie: session.cookie } },
    )
    let imageHtml = await imageResponse.text()
    assert.ok(
      imageHtml.includes('uplctl-kindfam-image.webp'),
      'image/* should match the Bilder tab',
    )
    assert.ok(!imageHtml.includes('uplctl-kindfam-data.json'), 'JSON should not match Bilder')

    let textResponse = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}?kind=text`, {
      headers: { Cookie: session.cookie },
    })
    let textHtml = await textResponse.text()
    assert.ok(textHtml.includes('uplctl-kindfam-data.json'), 'JSON should match the Text tab')
    assert.ok(!textHtml.includes('uplctl-kindfam-image.webp'), 'images should not match Text')
  })

  it('GET /admin/uploads ignores an unknown kind and intersects kind with the search', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let pdfId = Number(
      await insertUpload(db, {
        filename: 'uplctl-kindcombo-a.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    let textId = Number(
      await insertUpload(db, {
        filename: 'uplctl-kindcombo-b.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    await claimUploads(db, [pdfId, textId], userId, Number.MAX_SAFE_INTEGER)

    // An unrecognised kind must not narrow or break the grid (falls back to all).
    let unknown = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}?kind=bogus`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(unknown.status, 200)
    let unknownHtml = await unknown.text()
    assert.ok(unknownHtml.includes('uplctl-kindcombo-a.pdf'))
    assert.ok(unknownHtml.includes('uplctl-kindcombo-b.txt'))

    // kind + filter intersect: only the PDF matching the search survives.
    let combined = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?kind=pdf&filter=uplctl-kindcombo`,
      { headers: { Cookie: session.cookie } },
    )
    let combinedHtml = await combined.text()
    assert.ok(combinedHtml.includes('uplctl-kindcombo-a.pdf'))
    assert.ok(!combinedHtml.includes('uplctl-kindcombo-b.txt'))
  })

  it('GET /admin/uploads shows a kind-aware empty state', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let response = await router.fetch(
      `${BASE}${routes.admin.uploads.index.href()}?kind=image&filter=zzz-no-such-upload`,
      { headers: { Cookie: session.cookie } },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Keine Dateien für diese Suche und diesen Typ gefunden.'),
      'kind + search empty state should be shown',
    )
  })

  it('POST /admin/uploads/:id/delete preserves the active kind on redirect', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let id = Number(
      await insertUpload(db, {
        filename: 'uplctl-kind-del.pdf',
        mimeType: 'application/pdf',
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
    formData.set('_filter', '')
    formData.set('_kind', 'pdf')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.destroy.href({ id })}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.includes('kind=pdf'), 'redirect should preserve the active kind')
  })

  it('GET /admin/uploads renders a delete button and context-menu trigger per row', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let id = Number(
      await insertUpload(db, {
        filename: 'uplctl-del-button.txt',
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
        filename: 'uplctl-del-owner.txt',
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
    formData.set('_filter', 'uplctl-del-owner')

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
      location?.includes('filter=uplctl-del-owner'),
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
        filename: 'uplctl-del-other.txt',
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
        filename: 'uplctl-del-resolve.txt',
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
        filename: 'uplctl-bulk-ui.txt',
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
    assert.ok(html.includes(`name="ids" value="${id}"`), 'row should expose a named ids checkbox')
    assert.ok(html.includes('data-select-all'), 'header should expose a select-all toggle')
    assert.ok(html.includes('data-bulk-group'), 'the bulk toolbar should carry its toggle marker')
    assert.ok(html.includes('Ausgewählte löschen'), 'page should render the bulk delete button')
    assert.ok(html.includes('data-bulk-delete-form'), 'bulk form should carry its marker')
    assert.ok(
      html.includes(routes.admin.uploads.destroyMany.href()),
      'bulk form should target the destroy-many action',
    )
    assert.ok(
      html.includes('Ausgewählte herunterladen'),
      'page should render the bulk download button',
    )
    assert.ok(html.includes('data-bulk-download-form'), 'download form should carry its marker')
    assert.ok(html.includes('data-rmx-document'), 'download form should submit natively')
    assert.ok(
      html.includes(routes.admin.uploads.downloadMany.href()),
      'download form should target the download-many action',
    )
  })

  it('POST /admin/uploads/delete-many deletes the selected rows and redirects with a deleted banner', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let ids: number[] = []
    for (let i = 1; i <= 2; i++) {
      let id = Number(
        await insertUpload(db, {
          filename: `uplctl-bulk-del-${i}.txt`,
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
    formData.set('_filter', 'uplctl-bulk-del')

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
    assert.ok(
      location.includes('filter=uplctl-bulk-del'),
      'redirect should preserve the grid filter',
    )
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
        filename: 'uplctl-bulk-own.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    await claimUploads(db, [owned], userId, Number.MAX_SAFE_INTEGER)

    let other = Number(
      await insertUpload(db, {
        filename: 'uplctl-bulk-other.txt',
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
        filename: 'uplctl-bulk-nop.txt',
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

    let response = await router.fetch(`${BASE}${routes.admin.uploads.destroyManyResolve.href()}`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Datei-Upload'), 'resolver should render the uploads page')
  })

  it('GET /admin/uploads?deleted=3 renders the deleted banner', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.index.href()}?deleted=3`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('3 Dateien gelöscht.'), 'should render the deleted banner')
  })

  it('GET /admin/uploads/:id/download serves the claimed file with conditional and range support', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let content = Buffer.from('0123456789abcdef')
    let id = Number(
      await insertUpload(db, {
        filename: 'uplctl-download.txt',
        mimeType: 'text/plain',
        buffer: content,
        size: content.byteLength,
        now: Date.now(),
      }),
    )
    let claimed = await claimUploads(db, [id], userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test upload')

    let url = `${BASE}${routes.admin.uploads.download.href({ id })}`
    let response = await router.fetch(url, { headers: { Cookie: session.cookie } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8')
    assert.equal(response.headers.get('Content-Length'), String(content.byteLength))
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes')
    assert.equal(
      response.headers.get('Cache-Control'),
      'private, no-cache',
      'owner-scoped downloads must not be stored by shared caches',
    )
    let disposition = ContentDisposition.from(response.headers.get('Content-Disposition'))
    assert.equal(disposition.type, 'attachment')
    assert.equal(disposition.filename, 'uplctl-download.txt')
    assert.equal(await response.text(), content.toString())

    let etag = response.headers.get('ETag')
    assert.ok(etag, 'download should emit an ETag')
    assert.ok(etag.startsWith('W/"'), 'download should emit a weak ETag')

    let notModified = await router.fetch(url, {
      headers: { Cookie: session.cookie, 'If-None-Match': etag.slice(2) },
    })
    assert.equal(notModified.status, 304)
    assert.equal(notModified.headers.get('ETag'), etag)

    let partial = await router.fetch(url, {
      headers: { Cookie: session.cookie, Range: 'bytes=0-3' },
    })
    assert.equal(partial.status, 206)
    assert.equal(partial.headers.get('Content-Range'), `bytes 0-3/${content.byteLength}`)
    assert.equal(await partial.text(), '0123')

    let unsatisfiable = await router.fetch(url, {
      headers: { Cookie: session.cookie, Range: 'bytes=-0' },
    })
    assert.equal(unsatisfiable.status, 416)
    assert.equal(unsatisfiable.headers.get('Content-Range'), `bytes */${content.byteLength}`)

    let head = await router.fetch(url, {
      method: 'HEAD',
      headers: { Cookie: session.cookie },
    })
    assert.equal(head.status, 200)
    assert.equal(head.headers.get('Content-Length'), String(content.byteLength))
    assert.equal(await head.text(), '')
  })

  it('GET /admin/uploads/:id/download serves a zero-length file and ignores Range', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let content = Buffer.alloc(0)
    let id = Number(
      await insertUpload(db, {
        filename: 'uplctl-empty.txt',
        mimeType: 'text/plain',
        buffer: content,
        size: 0,
        now: Date.now(),
      }),
    )
    let claimed = await claimUploads(db, [id], userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim empty test upload')

    let url = `${BASE}${routes.admin.uploads.download.href({ id })}`
    let response = await router.fetch(url, { headers: { Cookie: session.cookie } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Length'), '0')
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes')
    assert.equal(await response.text(), '')

    let etag = response.headers.get('ETag')
    assert.ok(etag, 'empty download should emit an ETag')
    let notModified = await router.fetch(url, {
      headers: { Cookie: session.cookie, 'If-None-Match': etag.slice(2) },
    })
    assert.equal(notModified.status, 304)

    // RFC 9110 §14.2 lets a server ignore Range for an empty representation.
    let ignoredRange = await router.fetch(url, {
      headers: { Cookie: session.cookie, Range: 'bytes=0-' },
    })
    assert.equal(ignoredRange.status, 200, 'Range on an empty file is ignored')
    assert.equal(ignoredRange.headers.get('Content-Length'), '0')
    assert.equal(await ignoredRange.text(), '')

    let head = await router.fetch(url, {
      method: 'HEAD',
      headers: { Cookie: session.cookie },
    })
    assert.equal(head.status, 200)
    assert.equal(head.headers.get('Content-Length'), '0')
    assert.equal(await head.text(), '')
  })

  it('GET /admin/uploads/:id/download hides uploads the user has not claimed', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let id = Number(
      await insertUpload(db, {
        filename: 'uplctl-download-unclaimed.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('unclaimed'),
        size: 9,
        now: Date.now(),
      }),
    )

    let response = await router.fetch(`${BASE}${routes.admin.uploads.download.href({ id })}`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 404)
  })

  it('GET /admin/uploads/:id/download preserves quoted filenames without header injection', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let id = Number(
      await insertUpload(db, {
        filename: 'uplctl-quote"\r\nname.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('quoted'),
        size: 6,
        now: Date.now(),
      }),
    )
    let claimed = await claimUploads(db, [id], userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test upload')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.download.href({ id })}`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let header = response.headers.get('Content-Disposition')
    assert.ok(header, 'download should set Content-Disposition')
    assert.ok(!header.includes('\r') && !header.includes('\n'), 'header must not contain CR/LF')

    let disposition = ContentDisposition.from(header)
    assert.equal(disposition.type, 'attachment')
    assert.equal(disposition.filename, 'uplctl-quote"name.txt')
    assert.equal(await response.text(), 'quoted')
  })

  it('GET /admin/uploads/:id/download carries non-ASCII filenames in filename*', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let filename = 'uplctl-überweisung-ä.txt'
    let id = Number(
      await insertUpload(db, {
        filename,
        mimeType: 'text/plain',
        buffer: Buffer.from('encoded'),
        size: 7,
        now: Date.now(),
      }),
    )
    let claimed = await claimUploads(db, [id], userId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim test upload')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.download.href({ id })}`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)

    let header = response.headers.get('Content-Disposition')
    assert.ok(header, 'download should set Content-Disposition')
    assert.ok(/^[\x20-\x7E]+$/.test(header), 'the header value must stay ASCII')

    let disposition = ContentDisposition.from(header)
    assert.equal(disposition.type, 'attachment')
    assert.equal(disposition.filename, 'uplctl-_berweisung-_.txt', 'ASCII fallback')
    assert.ok(disposition.filenameSplat?.startsWith("UTF-8''"), 'must carry filename*')
    assert.equal(disposition.preferredFilename, filename, 'filename* must decode to the real name')
    assert.equal(await response.text(), 'encoded')
  })

  it('POST /admin/uploads/download-many returns a zip attachment of the selected rows', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let ids: number[] = []
    for (let i = 1; i <= 2; i++) {
      let id = Number(
        await insertUpload(db, {
          filename: `uplctl-bulk-dl-${i}.txt`,
          mimeType: 'text/plain',
          buffer: Buffer.from(`content-${i}`),
          size: 9,
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

    let response = await router.fetch(`${BASE}${routes.admin.uploads.downloadMany.href()}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/zip')
    let disposition = response.headers.get('Content-Disposition') ?? ''
    assert.ok(disposition.includes('attachment'), 'should be an attachment')
    assert.ok(disposition.includes('uploads.zip'), 'should carry the zip filename')
    assert.equal(
      response.headers.get('Cache-Control'),
      'private, no-store',
      'the owner-scoped archive must not be cached',
    )

    let buffer = Buffer.from(await response.arrayBuffer())
    assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50, 'should be a zip archive')
  })

  it("POST /admin/uploads/download-many leaves another user's upload out of the zip", async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let otherRow = await db.exec(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ('other-dl-ctrl@newapp.com', 'x', 'Other', 'customer', 1, 1, $1, $1)
       ON CONFLICT (email) DO UPDATE SET name = 'Other' RETURNING id`,
      [Date.now()],
    )
    let otherId = Number((otherRow.rows?.[0] as { id: number } | undefined)?.id)

    let owned = Number(
      await insertUpload(db, {
        filename: 'uplctl-bulk-dl-own.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('own'),
        size: 3,
        now: Date.now(),
      }),
    )
    await claimUploads(db, [owned], userId, Number.MAX_SAFE_INTEGER)

    let other = Number(
      await insertUpload(db, {
        filename: 'uplctl-bulk-dl-other.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('secret'),
        size: 6,
        now: Date.now(),
      }),
    )
    await pool.query('UPDATE uploads SET uploaded_by = $1 WHERE id = $2', [otherId, other])

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append('ids', String(owned))
    formData.append('ids', String(other))

    let response = await router.fetch(`${BASE}${routes.admin.uploads.downloadMany.href()}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 200)
    let buffer = Buffer.from(await response.arrayBuffer())
    let text = buffer.toString('utf8')
    assert.ok(text.includes('uplctl-bulk-dl-own.txt'), 'zip should contain the owned file')
    assert.ok(
      !text.includes('uplctl-bulk-dl-other.txt'),
      "another user's file must not be in the zip",
    )
  })

  it('POST /admin/uploads/download-many with no valid ids returns 400', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)

    let response = await router.fetch(`${BASE}${routes.admin.uploads.downloadMany.href()}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 400)
  })

  it('POST /admin/uploads/download-many returns 404 when no row matches the submitted ids', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create auth session')

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append('ids', '999999999')

    let response = await router.fetch(`${BASE}${routes.admin.uploads.downloadMany.href()}`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 404)
  })
})
