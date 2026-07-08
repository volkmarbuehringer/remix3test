import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { pool, initializeAppDatabase } from '../../data/setup.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrf, createAuthCookieWithCsrfForUser, createAuthCookieWithPendingBooking } from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import { __setTestCustomerAgent, customerChat, chatRateLimiter, bookingRateLimiter } from './controller.tsx'

const BASE = 'https://remix.run'
const CHAT_INDEX_URL = `${BASE}${routes.chat.index.href()}`
const CHAT_ACTION_URL = `${BASE}${routes.chat.action.href()}`

describe('Customer Chat controller', () => {
  let adminCookie: string
  let userCookie: string

  before(async () => {
    await initializeAppDatabase()

    let adminResult = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = adminResult?.cookie ?? ''

    let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = userResult?.cookie ?? ''
  })

  after(() => {
    __setTestCustomerAgent(undefined)
  })

  it('GET /chat redirects to login when not authenticated', async () => {
    let response = await router.fetch(CHAT_INDEX_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(
      location?.startsWith(routes.auth.login.index.href()),
      'should redirect to login with returnTo',
    )
  })

  it('GET /chat returns page for authenticated user', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_INDEX_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
  })

  it('GET /chat works for non-admin user', async () => {
    let response = await router.fetch(CHAT_INDEX_URL, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
  })

  it('POST /chat with empty message returns redirect with error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ message: '', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
  })

  it('POST /chat with valid message returns redirect with threadId using mock agent', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let mockAgent = {
      generate: async (_message: string, _opts?: any) => ({
        text: 'Ich empfehle Ihnen Raum 1, der für Ihre Bedürfnisse geeignet ist.',
      }),
    }
    __setTestCustomerAgent(mockAgent)

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ message: 'Ich brauche einen ruhigen Raum', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.includes('threadId='), 'response should redirect with threadId')

    __setTestCustomerAgent(undefined)
  })

  describe('slot detection from tool results', () => {
    type MockAgent = Parameters<typeof __setTestCustomerAgent>[0]

    async function postChatAndFollow(
      mockAgent: MockAgent,
      message: string,
    ): Promise<{ html: string; session: { cookie: string } }> {
      let session = await createAuthCookieWithCsrf()
      assert.ok(session?.cookie, 'Failed to create auth session')

      let adminResult = await pool.query(
        'SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'],
      )
      if (adminResult.rows.length > 0) {
        chatRateLimiter.reset(adminResult.rows[0].id as number)
      }

      __setTestCustomerAgent(mockAgent)
      try {
        let postResponse = await router.fetch(CHAT_ACTION_URL, {
          method: 'POST',
          headers: { Cookie: session.cookie },
          body: new URLSearchParams({ message, _csrf: session.csrfToken }),
          redirect: 'manual',
        })
        assert.equal(postResponse.status, 302)
        let location = postResponse.headers.get('Location')
        assert.ok(location, 'response should have Location header')
        if (location!.includes('error=')) {
          assert.ok(false, 'redirect contains error: ' + location)
        }
        let getUrl = location!.startsWith('http') ? location! : `${BASE}${location!}`
        let getResponse = await router.fetch(getUrl, {
          headers: { Cookie: session.cookie },
        })
        let html = await getResponse.text()
        return { html, session }
      } finally {
        __setTestCustomerAgent(undefined)
      }
    }

    it('POST /chat saves pendingBooking when agent returns slots across multiple days', async () => {
      let futureDate = Date.now() + 7 * 86_400_000
      let day1 = new Date(futureDate).setUTCHours(0, 0, 0, 0)
      let day2 = day1 + 86_400_000
      let day3 = day1 + 2 * 86_400_000
      let slots = [
        { date_epoch_ms: day1, date_display: 'Di, 14.07.', start_min: 600, end_min: 660 },
        { date_epoch_ms: day1, date_display: 'Di, 14.07.', start_min: 660, end_min: 720 },
        { date_epoch_ms: day2, date_display: 'Mi, 15.07.', start_min: 540, end_min: 600 },
        { date_epoch_ms: day2, date_display: 'Mi, 15.07.', start_min: 600, end_min: 660 },
        { date_epoch_ms: day3, date_display: 'Do, 16.07.', start_min: 480, end_min: 540 },
        { date_epoch_ms: day3, date_display: 'Do, 16.07.', start_min: 540, end_min: 600 },
        { date_epoch_ms: day3, date_display: 'Do, 16.07.', start_min: 600, end_min: 660 },
      ]

      let { html } = await postChatAndFollow({
        generate: async (_message: string, _opts?: any) => ({
          text: 'Hier sind die verfügbaren Termine.',
          toolCalls: [{
            type: 'tool-call',
            payload: {
              toolCallId: 'call-1',
              toolName: 'findNextAvailableSlots',
              args: { resourceId: 1, daysAhead: 30, title: 'Test Termin' },
            },
          }],
          toolResults: [{
            type: 'tool-result',
            payload: {
              toolCallId: 'call-1',
              toolName: 'findNextAvailableSlots',
              args: { resourceId: 1, daysAhead: 30, title: 'Test Termin' },
              result: {
                slots,
                resource_id: 1,
                resource_name: 'Test Ressource',
                title: 'Test Termin',
              },
            },
          }],
        }),
      }, 'Zeig mir Termine')

      assert.ok(html.includes('Termin buchen'), 'form button should be rendered')
      assert.ok(html.includes('Test Ressource'), 'resource name should appear in form')
      assert.ok(html.includes('10:00'), 'first slot start time should appear in form')
      assert.ok(html.includes('Di, 14.07.'), 'first day header should appear')
      assert.ok(!html.includes('Mi, 15.07.'), 'second day should be paginated away')
      assert.ok(!html.includes('Do, 16.07.'), 'third day should be paginated away')
      assert.ok(html.includes('1/3'), 'page indicator should show 1 of 3')
      assert.ok(html.includes('aria-label="Nächster Tag"'), 'next arrow should appear')
      assert.ok(!html.includes('aria-label="Vorheriger Tag"'), 'prev arrow should not appear on first page')
    })

    it('POST /chat does not save pendingBooking when agent returns empty slots', async () => {
      let { html } = await postChatAndFollow({
        generate: async (_message: string, _opts?: any) => ({
          text: 'Aktuell sind leider keine Termine verfügbar.',
          toolCalls: [{
            type: 'tool-call',
            payload: {
              toolCallId: 'call-1',
              toolName: 'findNextAvailableSlots',
              args: { resourceId: 1, daysAhead: 30, title: '' },
            },
          }],
          toolResults: [{
            type: 'tool-result',
            payload: {
              toolCallId: 'call-1',
              toolName: 'findNextAvailableSlots',
              args: { resourceId: 1, daysAhead: 30, title: '' },
              result: { slots: [], resource_id: 1, resource_name: 'Test', title: '' },
            },
          }],
        }),
      }, 'Termine anzeigen')

      assert.ok(html.includes('Beratung'), 'chat page should still render')
      assert.ok(!html.includes('Termin buchen'), 'should NOT include booking form when slots empty')
    })

    it('POST /chat does not save pendingBooking when agent makes no tool calls', async () => {
      let { html } = await postChatAndFollow({
        generate: async (_message: string, _opts?: any) => ({
          text: 'Ich kann Ihnen helfen. Bitte beschreiben Sie Ihr Anliegen genauer.',
        }),
      }, 'Ich brauche Hilfe')

      assert.ok(html.includes('Beratung'), 'chat page should still render')
      assert.ok(!html.includes('Termin buchen'), 'should NOT include booking form when no tool calls')
    })
  })

  describe('workflow trigger results from tool results', () => {
    type MockAgent = Parameters<typeof __setTestCustomerAgent>[0]
    let futureDayMs: number

    before(() => {
      let futureDate = Date.now() + 7 * 86_400_000
      futureDayMs = new Date(futureDate).setUTCHours(0, 0, 0, 0)
    })

    async function postChatAndFollow(
      mockAgent: MockAgent,
      message: string,
    ): Promise<{ html: string; session: { cookie: string } }> {
      let session = await createAuthCookieWithCsrf()
      assert.ok(session?.cookie, 'Failed to create auth session')

      let adminResult = await pool.query(
        'SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'],
      )
      if (adminResult.rows.length > 0) {
        chatRateLimiter.reset(adminResult.rows[0].id as number)
      }

      __setTestCustomerAgent(mockAgent)
      try {
        let postResponse = await router.fetch(CHAT_ACTION_URL, {
          method: 'POST',
          headers: { Cookie: session.cookie },
          body: new URLSearchParams({ message, _csrf: session.csrfToken }),
          redirect: 'manual',
        })
        assert.equal(postResponse.status, 302)
        let location = postResponse.headers.get('Location')
        assert.ok(location, 'response should have Location header')
        if (location!.includes('error=')) {
          assert.ok(false, 'redirect contains error: ' + location)
        }
        let getUrl = location!.startsWith('http') ? location! : `${BASE}${location!}`
        let getResponse = await router.fetch(getUrl, {
          headers: { Cookie: session.cookie },
        })
        let html = await getResponse.text()
        return { html, session }
      } finally {
        __setTestCustomerAgent(undefined)
      }
    }

    it('shows bookingResult success when triggerBookingWorkflow succeeds', async () => {
      let { html } = await postChatAndFollow({
        generate: async (_message: string, _opts?: any) => ({
          text: 'Termin wurde gebucht!',
          toolResults: [{
            type: 'tool-result',
            payload: {
              toolName: 'triggerBookingWorkflow',
              result: { success: true, appointmentId: 123, workflowRunId: 'r-1' },
            },
          }],
        }),
      }, 'Buch den Termin')

      assert.ok(html.includes('Termin #123'), 'should show booking success with id')
      assert.ok(html.includes('erfolgreich gebucht'), 'should show success message')
    })

    it('shows collision message when triggerBookingWorkflow returns collision', async () => {
      let { html } = await postChatAndFollow({
        generate: async (_message: string, _opts?: any) => ({
          text: 'Der Termin ist leider nicht mehr frei.',
          toolResults: [{
            type: 'tool-result',
            payload: {
              toolName: 'triggerBookingWorkflow',
              result: { success: false, error: 'collision' },
            },
          }],
        }),
      }, 'Buch den Termin')

      assert.ok(html.includes('nicht mehr frei'), 'should show collision message')
    })

    it('shows cancellation success when cancelBooking succeeds', async () => {
      let { html } = await postChatAndFollow({
        generate: async (_message: string, _opts?: any) => ({
          text: 'Termin wurde storniert!',
          toolResults: [{
            type: 'tool-result',
            payload: {
              toolName: 'cancelBooking',
              result: { success: true, workflowRunId: 'r-2' },
            },
          }],
        }),
      }, 'Storniere meinen Termin')

      assert.ok(html.includes('wurde storniert'), 'should show cancellation success')
    })

    it('shows not_owner message when cancelBooking returns not_owner', async () => {
      let { html } = await postChatAndFollow({
        generate: async (_message: string, _opts?: any) => ({
          text: 'Stornierung fehlgeschlagen.',
          toolResults: [{
            type: 'tool-result',
            payload: {
              toolName: 'cancelBooking',
              result: { success: false, error: 'not_owner' },
            },
          }],
        }),
      }, 'Storniere Termin 42')

      assert.ok(html.includes('gehört Ihnen nicht'), 'should show not_owner message')
    })

    it('shows already_cancelled message when cancelBooking returns already_cancelled', async () => {
      let { html } = await postChatAndFollow({
        generate: async (_message: string, _opts?: any) => ({
          text: 'Bereits storniert.',
          toolResults: [{
            type: 'tool-result',
            payload: {
              toolName: 'cancelBooking',
              result: { success: false, error: 'already_cancelled' },
            },
          }],
        }),
      }, 'Storniere Termin 42')

      assert.ok(html.includes('bereits storniert'), 'should show already_cancelled message')
    })
  })

  it('POST /chat with _action=confirm_booking triggers workflow', async () => {
    let futureDate = Date.now() + 7 * 86_400_000
    let futureDayMs = new Date(futureDate).setUTCHours(0, 0, 0, 0)
    let pendingBookingJson = JSON.stringify({
      slots: [{ date_epoch_ms: futureDayMs, date_display: 'Di, 14.07.', start_min: 600, end_min: 660 }],
      resource_id: 1,
      resource_name: 'Test Ressource',
      title: 'Test Termin',
    })
    let session = await createAuthCookieWithPendingBooking(pendingBookingJson)
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        _action: 'confirm_booking',
        resource_id: '1',
        day_start: String(futureDayMs) + ':600',
        title: 'Test Termin',
        threadId: crypto.randomUUID(),
        _csrf: session.csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.includes('threadId='), 'should redirect with threadId')
  })

  async function seedOffering(dayMs: number) {
    try {
      await pool.query(
        `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
         VALUES ($1::bigint, 1, int4range(480, 1080, '[)'), $2, $2)`,
        [dayMs, Date.now()],
      )
    } catch {
      // offering may already exist from another test
    }
  }

  it('confirm_booking keeps form open with remaining slots on success', async () => {
    let testDayMs = new Date(Date.UTC(2026, 6, 21)).getTime()
    await seedOffering(testDayMs)
    let rateLimiterAdmin = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'])
    if (rateLimiterAdmin.rows.length > 0) {
      bookingRateLimiter.reset(rateLimiterAdmin.rows[0].id as number)
    }
    let pendingBookingJson = JSON.stringify({
      slots: [
        { date_epoch_ms: testDayMs, date_display: 'Di, 21.07.', start_min: 600, end_min: 660 },
        { date_epoch_ms: testDayMs, date_display: 'Di, 21.07.', start_min: 660, end_min: 720 },
      ],
      resource_id: 1,
      resource_name: 'Test Ressource',
      title: 'Test Termin',
    })
    let session = await createAuthCookieWithPendingBooking(pendingBookingJson)
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        _action: 'confirm_booking',
        resource_id: '1',
        day_start: String(testDayMs) + ':600',
        title: 'Test Termin',
        threadId: crypto.randomUUID(),
        _csrf: session.csrfToken,
      }),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)

    let location = response.headers.get('Location')!
    assert.ok(!location.includes('error='), 'redirect should not contain error, got: ' + location)

    let getUrl = location.startsWith('http') ? location : `${BASE}${location}`
    let getResponse = await router.fetch(getUrl, { headers: { Cookie: session.cookie } })
    let html = await getResponse.text()

    assert.ok(html.includes('Termin buchen'), 'booking form should still be visible')
    assert.ok(html.includes('11:00'), 'remaining slot should be shown in form')
    assert.ok(!html.includes('day_start" value="' + String(testDayMs) + ':600'), 'booked slot should not be in form')
  })

  it('confirm_booking clears pendingBooking on last slot', async () => {
    let testDayMs = new Date(Date.UTC(2026, 6, 21)).getTime()
    await seedOffering(testDayMs)
    let rateLimiterAdmin = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'])
    if (rateLimiterAdmin.rows.length > 0) {
      bookingRateLimiter.reset(rateLimiterAdmin.rows[0].id as number)
    }
    let pendingBookingJson = JSON.stringify({
      slots: [{ date_epoch_ms: testDayMs, date_display: 'Di, 21.07.', start_min: 720, end_min: 780 }],
      resource_id: 1,
      resource_name: 'Test Ressource',
      title: 'Test Termin',
    })
    let session = await createAuthCookieWithPendingBooking(pendingBookingJson)
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        _action: 'confirm_booking',
        resource_id: '1',
        day_start: String(testDayMs) + ':720',
        title: 'Test Termin',
        threadId: crypto.randomUUID(),
        _csrf: session.csrfToken,
      }),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)

    let location = response.headers.get('Location')!
    assert.ok(!location.includes('error='), 'redirect should not contain error, got: ' + location)

    let getUrl = location.startsWith('http') ? location : `${BASE}${location}`
    let getResponse = await router.fetch(getUrl, { headers: { Cookie: session.cookie } })
    let html = await getResponse.text()

    assert.ok(!html.includes('Termin buchen'), 'booking form should be gone after last slot')
    assert.ok(html.includes('Termin #'), 'booking confirmation should be visible')
  })

  it('confirm_booking preserves pendingBooking on non-collision error', async () => {
    let pastEpochMs = 0
    let pendingBookingJson = JSON.stringify({
      slots: [{ date_epoch_ms: pastEpochMs, date_display: 'Do, 01.01.', start_min: 600, end_min: 660 }],
      resource_id: 1,
      resource_name: 'Test Ressource',
      title: 'Test Termin',
    })
    let session = await createAuthCookieWithPendingBooking(pendingBookingJson)
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        _action: 'confirm_booking',
        resource_id: '1',
        day_start: String(pastEpochMs) + ':600',
        title: 'Test Termin',
        threadId: crypto.randomUUID(),
        _csrf: session.csrfToken,
      }),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)

    let location = response.headers.get('Location')!
    let getUrl = location.startsWith('http') ? location : `${BASE}${location}`
    let getResponse = await router.fetch(getUrl, { headers: { Cookie: session.cookie } })
    let html = await getResponse.text()

    assert.ok(html.includes('Termin buchen'), 'booking form should still be visible on non-collision error')
  })

  it('confirm_booking removes colliding slot on exclusion constraint', async () => {
    let testDayMs = new Date(Date.UTC(2026, 6, 21)).getTime()
    await seedOffering(testDayMs)
    let rateLimiterAdmin = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'])
    if (rateLimiterAdmin.rows.length > 0) {
      bookingRateLimiter.reset(rateLimiterAdmin.rows[0].id as number)
    }
    let pendingBookingJson = JSON.stringify({
      slots: [
        { date_epoch_ms: testDayMs, date_display: 'Di, 21.07.', start_min: 480, end_min: 540 },
        { date_epoch_ms: testDayMs, date_display: 'Di, 21.07.', start_min: 540, end_min: 600 },
      ],
      resource_id: 1,
      resource_name: 'Test Ressource',
      title: 'Test Termin',
    })
    let session = await createAuthCookieWithPendingBooking(pendingBookingJson)
    assert.ok(session?.cookie, 'Failed to create auth session')

    let now = Date.now()
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES (1, 1, 'conflict', $1::bigint, int4range(480, 540, '[)'), $2, $2)`,
      [testDayMs, now],
    )

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        _action: 'confirm_booking',
        resource_id: '1',
        day_start: String(testDayMs) + ':480',
        title: 'Test Termin',
        threadId: crypto.randomUUID(),
        _csrf: session.csrfToken,
      }),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)

    let location = response.headers.get('Location')!
    let getUrl = location.startsWith('http') ? location : `${BASE}${location}`
    let getResponse = await router.fetch(getUrl, { headers: { Cookie: session.cookie } })
    let html = await getResponse.text()

    assert.ok(html.includes('Termin buchen'), 'booking form should still be visible after collision')
    assert.ok(!html.includes('day_start" value="' + String(testDayMs) + ':480'), 'collided slot should be removed from form')
    assert.ok(html.includes('day_start" value="' + String(testDayMs) + ':540'), 'other slot should still be in form')
  })

  it('POST /chat with _action=confirm_booking and missing params returns error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        _action: 'confirm_booking',
        _csrf: session.csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.includes('error='), 'should redirect with error')
  })

  it('POST /chat with _action=confirm_booking and no pendingBooking returns error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let futureDate = Date.now() + 7 * 86_400_000
    let futureDayMs = new Date(futureDate).setUTCHours(0, 0, 0, 0)

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        _action: 'confirm_booking',
        resource_id: '1',
        day_start: String(futureDayMs) + ':600',
        title: 'Test Termin',
        threadId: crypto.randomUUID(),
        _csrf: session.csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.includes('error='), 'should redirect with error')
  })

  it('POST /chat with _action=confirm_booking and mismatched slot returns error', async () => {
    let futureDate = Date.now() + 7 * 86_400_000
    let futureDayMs = new Date(futureDate).setUTCHours(0, 0, 0, 0)
    let pendingBookingJson = JSON.stringify({
      slots: [{ date_epoch_ms: futureDayMs, date_display: 'Di, 14.07.', start_min: 600, end_min: 660 }],
      resource_id: 1,
      resource_name: 'Test Ressource',
      title: 'Test Termin',
    })
    let session = await createAuthCookieWithPendingBooking(pendingBookingJson)
    assert.ok(session?.cookie, 'Failed to create auth session')

    // Submit a different slot (start_min: 720 instead of 600)
    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        _action: 'confirm_booking',
        resource_id: '1',
        day_start: String(futureDayMs) + ':720',
        title: 'Test Termin',
        threadId: crypto.randomUUID(),
        _csrf: session.csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.includes('error='), 'should redirect with error')
  })

  it('POST /chat clears stale pendingBooking when agent returns no slots', async () => {
    let futureDateMs = new Date(Date.now() + 7 * 86_400_000).setUTCHours(0, 0, 0, 0)
    let staleBooking = JSON.stringify({
      slots: [{ date_epoch_ms: futureDateMs, date_display: 'Test', start_min: 600, end_min: 660 }],
      resource_id: 1, resource_name: 'Test', title: 'Test',
    })
    let session = await createAuthCookieWithPendingBooking(staleBooking)
    assert.ok(session?.cookie, 'Failed to create auth session')

    let adminResult = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'])
    if (adminResult.rows.length > 0) chatRateLimiter.reset(adminResult.rows[0].id as number)

    let mockAgent = {
      generate: async () => ({ text: 'Ich verstehe. Kannst du dein Anliegen genauer beschreiben?' }),
    }
    __setTestCustomerAgent(mockAgent)
    try {
      let postResponse = await router.fetch(CHAT_ACTION_URL, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({ message: 'etwas anderes', _csrf: session.csrfToken }),
        redirect: 'manual',
      })
      assert.equal(postResponse.status, 302)
      let location = postResponse.headers.get('Location')!
      let getUrl = location.startsWith('http') ? location : `${BASE}${location}`
      let getResponse = await router.fetch(getUrl, { headers: { Cookie: session.cookie } })
      let html = await getResponse.text()
      assert.ok(!html.includes('Termin buchen'), 'stale booking form should be cleared')
    } finally {
      __setTestCustomerAgent(undefined)
    }
  })

  it('GET /chat with ?cancel=1 clears pendingBooking and redirects', async () => {
    let futureDate = Date.now() + 7 * 86_400_000
    let futureDayMs = new Date(futureDate).setUTCHours(0, 0, 0, 0)
    let pendingBookingJson = JSON.stringify({
      slots: [{ date_epoch_ms: futureDayMs, date_display: 'Di, 14.07.', start_min: 600, end_min: 660 }],
      resource_id: 1,
      resource_name: 'Test Ressource',
      title: 'Test Termin',
    })
    let session = await createAuthCookieWithPendingBooking(pendingBookingJson)
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_INDEX_URL + '?cancel=1', {
      headers: { Cookie: session.cookie },
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    assert.ok(!response.headers.get('Location')?.includes('cancel'), 'redirect should not contain cancel param')

    // Follow redirect — booking form should be gone
    let followUrl = response.headers.get('Location')!
    let followResponse = await router.fetch(followUrl.startsWith('http') ? followUrl : `${BASE}${followUrl}`, {
      headers: { Cookie: session.cookie },
    })
    let html = await followResponse.text()
    assert.ok(!html.includes('Termin buchen'), 'booking form should be gone after cancel')
  })

  it('GET /chat with ?cancel=1&threadId=X preserves threadId', async () => {
    let threadId = crypto.randomUUID()
    let futureDate = Date.now() + 7 * 86_400_000
    let futureDayMs = new Date(futureDate).setUTCHours(0, 0, 0, 0)
    let pendingBookingJson = JSON.stringify({
      slots: [{ date_epoch_ms: futureDayMs, date_display: 'Di, 14.07.', start_min: 600, end_min: 660 }],
      resource_id: 1,
      resource_name: 'Test',
      title: 'Test',
    })
    let session = await createAuthCookieWithPendingBooking(pendingBookingJson)
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_INDEX_URL + '?cancel=1&threadId=' + encodeURIComponent(threadId), {
      headers: { Cookie: session.cookie },
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.includes(threadId), 'redirect should preserve threadId')
  })

  it('POST /chat continues an existing thread when threadId is provided', async () => {
    let existingThreadId = crypto.randomUUID()

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let adminResult = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'])
    if (adminResult.rows.length > 0) {
      chatRateLimiter.reset(adminResult.rows[0].id as number)
    }

    let mockAgent = {
      generate: async (_message: string, opts?: any) => {
        assert.equal(opts?.memory?.thread, existingThreadId)
        return { text: 'Fortsetzung der Beratung.' }
      },
    }
    __setTestCustomerAgent(mockAgent)

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        message: 'weiter',
        _csrf: session.csrfToken,
        threadId: existingThreadId,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.includes(existingThreadId), 'should continue the existing thread')

    __setTestCustomerAgent(undefined)
  })
})
