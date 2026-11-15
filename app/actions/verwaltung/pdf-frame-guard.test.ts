import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'

// ---------------------------------------------------------------------------
// Frame download guard (guide 06 §"Resolve frames in the browser").
//
// PDF routes are linked with `data-rmx-document`, so a normal download never
// carries `X-Remix-Frame`. A framed direct hit used to redirect to the same URL
// while still carrying the header; fetch follows the redirect with the header,
// so the request loops until the browser aborts and the whole runtime shows the
// fatal card. The one-shot marker redirects to a real page on the second pass.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'

describe('Verwaltung PDF frame guard', () => {
  let adminCookie: string

  before(async () => {
    await initializeAppDatabase()
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    adminCookie = auth.cookie
  })

  it('marks a framed /verwaltung/pdf request once, then sends it to the dashboard', async () => {
    let first = await router.fetch(BASE + routes.verwaltung.pdf.index.href(), {
      headers: { Cookie: adminCookie, 'X-Remix-Frame': 'true' },
      redirect: 'manual',
    })
    assert.equal(first.status, 303)
    let marked = first.headers.get('Location') ?? ''
    assert.ok(marked.includes('frameDownload=1'), 'the first pass should add the marker')

    let second = await router.fetch(new URL(marked, BASE), {
      headers: { Cookie: adminCookie, 'X-Remix-Frame': 'true' },
      redirect: 'manual',
    })
    assert.equal(second.status, 303)
    assert.equal(second.headers.get('Location'), routes.verwaltung.index.href())
  })

  it('marks a framed /verwaltung/users-pdf request once, then sends it to the export page', async () => {
    let first = await router.fetch(BASE + routes.verwaltung.usersPdf.index.href(), {
      headers: { Cookie: adminCookie, 'X-Remix-Frame': 'true' },
      redirect: 'manual',
    })
    assert.equal(first.status, 303)
    let marked = first.headers.get('Location') ?? ''
    assert.ok(marked.includes('frameDownload=1'), 'the first pass should add the marker')

    let second = await router.fetch(new URL(marked, BASE), {
      headers: { Cookie: adminCookie, 'X-Remix-Frame': 'true' },
      redirect: 'manual',
    })
    assert.equal(second.status, 303)
    assert.equal(second.headers.get('Location'), routes.verwaltung.usersExport.index.href())
  })
})
