import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { ContentDisposition, ContentType } from 'remix/headers'

import { router } from '../../../test-router.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { createAuthCookieWithCsrfForUser } from '../../../../test/utils.ts'
import { routes } from '../../../routes.ts'

const BASE = 'https://remix.run'
const USERS_URL = BASE + routes.admin.users.index.href()
const OUTPUT_URL = BASE + routes.admin.output.index.href()

function expectPdf(response: Response, buffer: ArrayBuffer): void {
  assert.equal(response.status, 200)
  assert.equal(String.fromCharCode(...new Uint8Array(buffer, 0, 4)), '%PDF')
}

describe('Admin users PDF output (/admin/output)', () => {
  let adminCookie: string
  let userCookie: string

  before(async () => {
    await initializeAppDatabase()
    let adminAuth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!adminAuth) throw new Error('admin@newapp.com not found in seed')
    adminCookie = adminAuth.cookie
    let userAuth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!userAuth) throw new Error('user@newapp.com not found in seed')
    userCookie = userAuth.cookie
  })

  async function fetchPdf(path: string): Promise<ArrayBuffer> {
    let response = await router.fetch(OUTPUT_URL + path, { headers: { Cookie: adminCookie } })
    return response.arrayBuffer()
  }

  it('returns a PDF attachment for an admin', async () => {
    let response = await router.fetch(OUTPUT_URL, { headers: { Cookie: adminCookie } })
    let contentType = ContentType.from(response.headers.get('Content-Type'))
    assert.equal(contentType.mediaType, 'application/pdf')

    let disposition = ContentDisposition.from(response.headers.get('Content-Disposition'))
    assert.equal(disposition.type, 'attachment')
    assert.ok(disposition.filename?.startsWith('benutzer-'), 'filename should describe the export')
    assert.ok(disposition.filename?.endsWith('.pdf'))

    let buffer = await response.arrayBuffer()
    assert.ok(buffer.byteLength > 0, 'body should not be empty')
    expectPdf(response, buffer)
  })

  it('applies the search filter to the export (fewer rows, smaller file)', async () => {
    let full = await fetchPdf('')
    let filtered = await fetchPdf('?filter=admin')
    assert.ok(full.byteLength > 0)
    assert.ok(
      filtered.byteLength < full.byteLength,
      'the filtered export must contain fewer rows than the full export',
    )
  })

  it('exports every matching row regardless of the grid offset', async () => {
    let full = await fetchPdf('')
    let offset = await fetchPdf('?offset=15')
    assert.equal(offset.byteLength, full.byteLength, 'the offset must not narrow the export')
  })

  it('accepts the status filter and the grid sort parameters', async () => {
    let response = await router.fetch(OUTPUT_URL + '?status=enabled&sort=email&order=desc', {
      headers: { Cookie: adminCookie },
    })
    expectPdf(response, await response.arrayBuffer())
  })

  it('falls back to safe defaults for unknown sort/order values', async () => {
    let response = await router.fetch(OUTPUT_URL + '?sort=password_hash&order=drop', {
      headers: { Cookie: adminCookie },
    })
    expectPdf(response, await response.arrayBuffer())
  })

  it('returns 403 for a non-admin user', async () => {
    let response = await router.fetch(OUTPUT_URL, { headers: { Cookie: userCookie } })
    assert.equal(response.status, 403)
  })

  it('redirects to login when not authenticated', async () => {
    let response = await router.fetch(OUTPUT_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
    assert.ok((response.headers.get('Location') ?? '').startsWith(routes.auth.login.index.href()))
  })

  it('redirects a framed request to the marker URL exactly once', async () => {
    let response = await router.fetch(OUTPUT_URL + '?filter=admin', {
      headers: { Cookie: adminCookie, 'X-Remix-Frame': 'true' },
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.includes(routes.admin.output.index.href()))
    assert.ok(location.includes('filter=admin'), 'location should keep the view params')
    assert.ok(location.includes('frameDownload=1'), 'location should carry the marker param')
  })

  it('renders the users page for the framed marker so the chain terminates', async () => {
    let response = await router.fetch(OUTPUT_URL + '?filter=admin&frameDownload=1', {
      headers: { Cookie: adminCookie, 'X-Remix-Frame': 'true' },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('data-users-pdf'), 'should render the users page as HTML')
    assert.ok(!html.startsWith('%PDF'), 'must not return the binary inside a frame')
  })

  it('links the users page to the filtered/sorted export without the offset', async () => {
    let response = await router.fetch(
      USERS_URL + '?offset=15&filter=Admin&status=enabled&sort=email&order=desc',
      { headers: { Cookie: adminCookie } },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('data-rmx-document'), 'the link must bypass frame interception')
    assert.ok(html.includes('data-users-pdf'), 'the export link should be present')

    let match = html.match(/href="(\/admin\/output\?[^"]*)"/)
    assert.ok(match, 'the users page should link to /admin/output')
    let href = match![1]!.replaceAll('&amp;', '&')
    assert.ok(href.includes('filter=Admin'), 'the link should carry the search term')
    assert.ok(href.includes('status=enabled'), 'the link should carry the status filter')
    assert.ok(href.includes('sort=email'), 'the link should carry the sort column')
    assert.ok(href.includes('order=desc'), 'the link should carry the sort direction')
    assert.ok(!href.includes('offset='), 'the export covers all rows, not just this page')
  })
})
