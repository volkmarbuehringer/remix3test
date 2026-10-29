import { afterEach, before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../../../db.ts'
import { deleteUploadFile, listUploadFiles } from '../../../data/upload-files.ts'
import { routes } from '../../../routes.ts'
import { uploadFiles } from '../../../storage.ts'
import { router } from '../../../test-router.ts'
import {
  createAuthCookieWithCsrf,
  createAuthCookieWithCsrfForUser,
} from '../../../../test/utils.ts'

const BASE = 'https://remix.run'
const PAGE_URL = `${BASE}${routes.admin.uploadnew.index.href()}`
const ACTION_URL = `${BASE}${routes.admin.uploadnew.action.href()}`

const TEST_FILE_PREFIX = 'uplnew-'

/** A real 1×1 PNG so the stored-bytes check has a matching signature. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** Indexed rows created by this suite (filename prefix). */
async function listTestFiles() {
  let files = await listUploadFiles(db, { limit: 1000 })
  return files.filter((file) => file.filename.startsWith(TEST_FILE_PREFIX))
}

/** Remove both the index row and its filesystem object. */
async function removeTestFiles() {
  for (let file of await listTestFiles()) {
    await deleteUploadFile(db, file.id)
    try {
      await uploadFiles.remove(file.storage_key)
    } catch {
      // Already gone; the index row is the authority for cleanup purposes.
    }
  }
}

function storedFileNamed(name: string) {
  return listTestFiles().then((files) => files.find((file) => file.filename === name))
}

function notFoundOrStored(name: string) {
  return storedFileNamed(name).then((file) => file === undefined)
}

describe('Admin UploadNew controller (filesystem bytes + DB metadata)', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await removeTestFiles()
  })

  it('GET /admin/uploadnew redirects unauthenticated users to login', async () => {
    let response = await router.fetch(PAGE_URL, { redirect: 'manual' })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login')
  })

  it('GET /admin/uploadnew rejects a non-admin session', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create a non-admin session')

    let response = await router.fetch(PAGE_URL, {
      headers: { Cookie: session.cookie },
      redirect: 'manual',
    })

    assert.equal(response.status, 403)
  })

  it('renders the streaming upload form for an admin', async () => {
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Could not create an admin session')

    let response = await router.fetch(PAGE_URL, { headers: { Cookie: session.cookie } })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Datei-Upload (Dateisystem)'), 'page should name the route')
    assert.ok(html.includes('name="file"'), 'page should contain the file input')
    assert.ok(html.includes('multiple'), 'file input should allow multiple files')
    assert.ok(html.includes('enctype="multipart/form-data"'), 'form must be multipart')
    assert.ok(
      html.includes('Upload (Dateisystem)'),
      'the sidebar should link the filesystem upload route',
    )
    assert.ok(
      /<a[^>]*href="\/admin\/uploadnew"[^>]*aria-current="page"/.test(html),
      'the new sidebar item should be marked active on its own page',
    )
  })

  it('rejects an unauthenticated multipart upload before parsing it', async () => {
    let name = `${TEST_FILE_PREFIX}unauth.png`
    let formData = new FormData()
    formData.append('file', new File([PNG_BYTES], name, { type: 'image/png' }))

    let response = await router.fetch(ACTION_URL, { method: 'POST', body: formData })

    assert.equal(response.status, 401)
    assert.equal(
      await notFoundOrStored(name),
      true,
      'the rejected upload must not be indexed or stored',
    )
  })

  it('rejects a non-admin multipart upload before parsing it', async () => {
    let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!session) throw new Error('Could not create a non-admin session')

    let name = `${TEST_FILE_PREFIX}nonadmin.png`
    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append('file', new File([PNG_BYTES], name, { type: 'image/png' }))

    let response = await router.fetch(ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 401, 'only admins may write to the filesystem route')
    assert.equal(
      await notFoundOrStored(name),
      true,
      'a non-admin upload must not be indexed or stored',
    )
  })

  it('rejects a cross-origin authenticated upload before parsing it', async () => {
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Could not create an admin session')

    let name = `${TEST_FILE_PREFIX}cross-origin.png`
    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append('file', new File([PNG_BYTES], name, { type: 'image/png' }))

    let response = await router.fetch(ACTION_URL, {
      method: 'POST',
      headers: {
        Cookie: session.cookie,
        Origin: 'https://evil.example',
        'Sec-Fetch-Site': 'cross-site',
      },
      body: formData,
    })

    assert.equal(response.status, 403, 'cross-origin uploads must fail before parsing')
    assert.equal(
      await notFoundOrStored(name),
      true,
      'the rejected upload must not be indexed or stored',
    )
  })

  it('protects downloads: non-admin 403, anonymous 302, malformed id 404', async () => {
    let adminSession = await createAuthCookieWithCsrf()
    if (!adminSession) throw new Error('Could not create an admin session')

    let name = `${TEST_FILE_PREFIX}download-guard.png`
    let formData = new FormData()
    formData.set('_csrf', adminSession.csrfToken)
    formData.append('file', new File([PNG_BYTES], name, { type: 'image/png' }))
    await router.fetch(ACTION_URL, {
      method: 'POST',
      headers: { Cookie: adminSession.cookie },
      body: formData,
    })

    let stored = await storedFileNamed(name)
    assert.ok(stored, 'the fixture upload should be indexed')
    let downloadUrl = `${BASE}${routes.admin.uploadnew.download.href({ id: stored.id })}`

    let nonAdmin = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!nonAdmin) throw new Error('Could not create a non-admin session')
    let forbidden = await router.fetch(downloadUrl, {
      headers: { Cookie: nonAdmin.cookie },
      redirect: 'manual',
    })
    assert.equal(forbidden.status, 403)

    let anonymous = await router.fetch(downloadUrl, { redirect: 'manual' })
    assert.equal(anonymous.status, 302)
    assert.ok(anonymous.headers.get('Location')?.startsWith(routes.auth.login.index.href()))

    let malformed = await router.fetch(
      `${BASE}${routes.admin.uploadnew.download.href({ id: 'not-an-id' })}`,
      { headers: { Cookie: adminSession.cookie } },
    )
    assert.equal(malformed.status, 404)
  })

  it('streams an accepted file to the filesystem and indexes its metadata', async () => {
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Could not create an admin session')

    let name = `${TEST_FILE_PREFIX}ok.png`
    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append('file', new File([PNG_BYTES], name, { type: 'image/png' }))

    let response = await router.fetch(ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Datei erfolgreich im Dateisystem gespeichert.'),
      'success banner should confirm the filesystem write',
    )
    assert.ok(html.includes(name), 'the stored file should be listed by its original name')
    assert.ok(html.includes('data-download-link'), 'row should use the icon download action')
    assert.ok(html.includes('data-delete-form'), 'row should use the icon delete action')
    assert.ok(
      html.includes(`aria-label="${name} herunterladen"`),
      'the download icon should name the file for assistive tech',
    )
    assert.ok(
      html.includes(`aria-label="${name} löschen"`),
      'the delete icon should name the file for assistive tech',
    )

    let stored = await storedFileNamed(name)
    assert.ok(stored, 'the file should be indexed in upload_files')
    assert.equal(stored.mime_type, 'image/png')
    assert.equal(stored.size, PNG_BYTES.length)
    assert.ok(stored.storage_key.length > 0, 'the index row must carry the filesystem storage key')

    // The bytes live only in filesystem storage; the index row just points at them.
    let file = await uploadFiles.get(stored.storage_key)
    assert.ok(file, 'the storage key should resolve to a stored file')

    let download = await router.fetch(
      `${BASE}${routes.admin.uploadnew.download.href({ id: stored.id })}`,
      { headers: { Cookie: session.cookie } },
    )

    assert.equal(download.status, 200)
    assert.equal(download.headers.get('Content-Type'), 'image/png')
    assert.match(download.headers.get('Content-Disposition') ?? '', /^attachment;/)
    let bytes = Buffer.from(await download.arrayBuffer())
    assert.ok(bytes.equals(PNG_BYTES), 'the download should return the stored bytes')
  })

  it('removes a file whose bytes do not match its declared type', async () => {
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Could not create an admin session')

    let name = `${TEST_FILE_PREFIX}mismatch.png`
    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append('file', new File([Buffer.from('not a png')], name, { type: 'image/png' }))

    let response = await router.fetch(ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Der Dateiinhalt passt nicht zum Dateityp.'),
      'the rejection should be explained on the page',
    )
    assert.equal(
      await notFoundOrStored(name),
      true,
      'a file that fails content validation must not be indexed or stored',
    )
  })

  it('rejects a file whose extension is not on the allowlist', async () => {
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Could not create an admin session')

    let name = `${TEST_FILE_PREFIX}script.html`
    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.append(
      'file',
      new File([Buffer.from('<script>alert(1)</script>')], name, { type: 'text/html' }),
    )

    let response = await router.fetch(ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Dateityp nicht erlaubt.'), 'the rejection should be explained')
    assert.equal(
      await notFoundOrStored(name),
      true,
      'the disallowed file must not be indexed or stored',
    )
  })

  it('deletes the index row and the filesystem object', async () => {
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Could not create an admin session')

    let name = `${TEST_FILE_PREFIX}delete.png`
    let uploadForm = new FormData()
    uploadForm.set('_csrf', session.csrfToken)
    uploadForm.append('file', new File([PNG_BYTES], name, { type: 'image/png' }))
    await router.fetch(ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: uploadForm,
    })

    let stored = await storedFileNamed(name)
    assert.ok(stored, 'the fixture upload should be indexed')

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)

    let response = await router.fetch(
      `${BASE}${routes.admin.uploadnew.destroy.href({ id: stored.id })}`,
      {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: formData,
        redirect: 'manual',
      },
    )

    assert.equal(response.status, 302)
    assert.ok(
      (response.headers.get('Location') ?? '').startsWith(routes.admin.uploadnew.index.href()),
      'delete should redirect back to the upload page',
    )
    assert.equal(await notFoundOrStored(name), true, 'the index row must be deleted')
    assert.equal(
      await uploadFiles.get(stored.storage_key),
      null,
      'the filesystem object must be deleted',
    )
  })
})
