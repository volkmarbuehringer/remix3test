import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { ContentDisposition, ContentType } from 'remix/headers'

import { router } from '../../../test-router.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { routes } from '../../../routes.ts'

const BASE = 'https://remix.run'
const PDF_URL = `${BASE}${routes.verwaltung.usersPdf.index.href()}`

describe('Verwaltung Users PDF', () => {
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

  it('GET /verwaltung/users-pdf returns a PDF download for admin', async () => {
    let response = await router.fetch(PDF_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let contentType = ContentType.from(response.headers.get('Content-Type'))
    assert.equal(contentType.mediaType, 'application/pdf')
    let disposition = ContentDisposition.from(response.headers.get('Content-Disposition'))
    assert.equal(disposition.type, 'attachment')
    assert.ok(disposition.filename?.endsWith('.pdf'))
    let buffer = await response.arrayBuffer()
    assert.ok(buffer.byteLength > 0)
    let header = new Uint8Array(buffer, 0, 4)
    assert.equal(String.fromCharCode(...header), '%PDF')
  })

  it('GET /verwaltung/users-pdf returns 403 for non-admin', async () => {
    let response = await router.fetch(PDF_URL, {
      headers: { Cookie: userCookie },
      redirect: 'manual',
    })
    assert.equal(response.status, 403)
  })

  it('GET /verwaltung/users-pdf redirects to login when not authenticated', async () => {
    let response = await router.fetch(PDF_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
    assert.ok((response.headers.get('Location') ?? '').startsWith(routes.auth.login.index.href()))
  })
})
