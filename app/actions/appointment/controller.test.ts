import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes, frames } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'

const BASE = 'https://remix.run'
const APPOINTMENT_URL = BASE + routes.appointment.index.href()

/**
 * Server-rendered appointment navigation.
 *
 * The year/week/resource control used to be a page-wide clientEntry that built
 * URLs and called navigate(). It is now a plain GET form plus prev/next links
 * targeting the appointmentContent frame, so the controls must be present in
 * the initial HTML and the fragment response must not re-render the document
 * shell (the frame-in-frame double-load crash).
 */
describe('Appointment controller', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  describe('GET /appointment (full page)', () => {
    it('renders the document shell plus a blocking appointment-content frame', async () => {
      let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(APPOINTMENT_URL, {
        headers: { Cookie: session.cookie },
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(html.includes('<html'), 'full page keeps the document shell')
      assert.ok(
        html.includes('data-rmx-target="appointment-content"'),
        'the picker targets the appointment-content frame',
      )
      // The blocking frame resolves its src during SSR, so the frame content is
      // part of the initial HTML (and the no-JS/no-clientEntry first paint).
      assert.ok(html.includes('id="appointment-data"'), 'frame content is inlined')
      assert.ok(html.includes('aria-label="Terminnavigation"'), 'the sidebar is server-rendered')
    })

    it('renders the controls as a normal GET form and prev/next links', async () => {
      let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(APPOINTMENT_URL + '?year=2026&week=20', {
        headers: { Cookie: session.cookie },
      })
      let html = await response.text()

      assert.ok(html.includes('method="get"'), 'the picker form is a GET form')
      assert.ok(html.includes('action="/appointment"'), 'the form posts back to /appointment')
      assert.ok(html.includes('name="year"'), 'year select is part of the form')
      assert.ok(html.includes('name="week"'), 'week select is part of the form')
      assert.ok(html.includes('name="resource_id"'), 'resource select is part of the form')
      assert.ok(html.includes('aria-label="Nächste Woche"'), 'next-week link is server-rendered')
      assert.ok(html.includes('aria-label="Vorherige Woche"'), 'prev-week link is server-rendered')
      assert.ok(html.includes('data-rmx-key="2026-20-'), 'the picker is keyed to the frame view')
      assert.ok(
        html.includes('href="/appointment?year=2026&amp;week=21'),
        'the next link advances the week',
      )
    })
  })

  describe('GET /appointment (frame fragment)', () => {
    it('returns only the appointment content without the document shell', async () => {
      let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(APPOINTMENT_URL + '?year=2026&week=20', {
        headers: { Cookie: session.cookie, 'X-Remix-Target': frames.appointmentContent },
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(!html.includes('<html'), 'the fragment must not contain the document shell')
      assert.ok(html.includes('id="appointment-data"'), 'the fragment carries the grid data')
      assert.ok(
        html.includes('aria-label="Terminnavigation"'),
        'the sidebar is part of the fragment',
      )
      assert.ok(
        html.includes('data-rmx-target="appointment-content"'),
        'links inside the fragment keep targeting the frame',
      )
      assert.equal(
        (html.match(/aria-label="Terminnavigation"/g) ?? []).length,
        1,
        'the shell must not be nested inside the fragment',
      )
    })

    it('redirects an unauthenticated frame request to login', async () => {
      let response = await router.fetch(APPOINTMENT_URL, {
        headers: { 'X-Remix-Target': frames.appointmentContent },
        redirect: 'manual',
      })

      assert.equal(response.status, 302)
      assert.ok(
        response.headers.get('Location')?.startsWith(routes.auth.login.index.href()),
        'should redirect to login',
      )
    })
  })
})
