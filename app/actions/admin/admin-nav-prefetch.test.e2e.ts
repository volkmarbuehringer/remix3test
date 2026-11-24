import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes, frames } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { runFrameProbe } from '../../../test/frame-probe.ts'
import { initializeAppDatabase } from '../../db.ts'

// ---------------------------------------------------------------------------
// Admin sidebar — frame prefetch end-to-end.
//
// The sidebar links are frame navigations, so they opt into
// `data-rmx-prefetch="intent"` (and skip it for document links and the active
// item). Only the real client runtime (`run({ prefetch })`) starts the
// listeners, so this cannot be a component test.
//
// Measurement: hovering a section link warms exactly one fragment request
// through the app resolver, and the click must be served from that warm — a
// second request means the claim regressed (key/target drift, cache cleared
// early) and the prefetch is paying an SSR cost with no navigation benefit.
//
// The mutation probe reverses that contract: a failed frame POST must clear
// the warm, so a subsequent click cannot render pre-mutation data from it.
// The test-only latency/failure simulation makes that race observable without
// changing production behavior.
// ---------------------------------------------------------------------------

describe('admin sidebar: frame prefetch', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('serves a clicked section link from the hover warm', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.index.href())
    let link = page
      .locator('#sidebar-shell-nav')
      .getByRole('link', { name: 'Benutzer', exact: true })
    await link.waitFor({ timeout: 15_000 })

    assert.equal(await link.getAttribute('data-rmx-prefetch'), 'intent')
    assert.equal(await link.getAttribute('data-rmx-target'), frames.adminContent)

    let active = page
      .locator('#sidebar-shell-nav')
      .getByRole('link', { name: 'Dashboard', exact: true })
    assert.equal(await active.getAttribute('data-rmx-prefetch'), null)

    let target = new URL(routes.admin.users.index.href(), server.baseUrl).href
    let requests = 0
    page.on('request', (request) => {
      if (request.url() === target) requests++
    })

    // The runtime starts the warm on pointer intent (100 ms); wait for its
    // response so the click is a claim rather than a race.
    let warm = page.waitForResponse(
      (response) =>
        response.url() === target && response.request().headers()['x-remix-frame'] === 'true',
      { timeout: 15_000 },
    )
    await link.hover()
    await warm

    assert.equal(requests, 1, 'hovering the marked sidebar link warms exactly one fragment request')

    await link.click()
    await page.waitForURL((url) => url.pathname === routes.admin.users.index.href(), {
      timeout: 15_000,
    })

    assert.equal(requests, 1, 'the click must reuse the warmed response, not fetch a second SSR')
  })

  it('joins an in-flight hover warm instead of fetching twice', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let usersPath = routes.admin.users.index.href()
    let server = await createTestServer((request) =>
      runFrameProbe(request, () => router.fetch(request), {
        delayMs: (probeRequest) => {
          let url = new URL(probeRequest.url)
          return probeRequest.method === 'GET' && url.pathname === usersPath ? 250 : 0
        },
      }),
    )
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.index.href())
    let link = page
      .locator('#sidebar-shell-nav')
      .getByRole('link', { name: 'Benutzer', exact: true })
    await link.waitFor({ timeout: 15_000 })

    let target = new URL(usersPath, server.baseUrl).href
    let requests = 0
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        request.url() === target &&
        request.headers()['x-remix-frame'] === 'true'
      ) {
        requests++
      }
    })

    let warmStarted = page.waitForRequest(
      (request) =>
        request.method() === 'GET' &&
        request.url() === target &&
        request.headers()['x-remix-frame'] === 'true',
      { timeout: 5_000 },
    )
    await link.hover()
    await warmStarted
    assert.equal(requests, 1, 'the hover warm must start before the click')

    // The server holds the warm open for 250 ms. Clicking now must make the
    // resolver await that request instead of starting a second SSR.
    await link.click()
    await page.waitForURL((url) => url.pathname === usersPath, { timeout: 15_000 })

    assert.equal(requests, 1, 'the navigation must join the in-flight warm')
  })

  it('invalidates a hover warm after a failed frame mutation', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let mutationPath = routes.admin.webhookRequests.create.action.href()
    let server = await createTestServer((request) =>
      runFrameProbe(request, () => router.fetch(request), {
        delayMs: 75,
        shouldFail: (probeRequest) => {
          let url = new URL(probeRequest.url)
          return probeRequest.method === 'POST' && url.pathname === mutationPath
        },
      }),
    )
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.index.href())
    let link = page
      .locator('#sidebar-shell-nav')
      .getByRole('link', { name: 'Benutzer', exact: true })
    await link.waitFor({ timeout: 15_000 })

    let target = new URL(routes.admin.users.index.href(), server.baseUrl).href
    let requests = 0
    page.on('request', (request) => {
      if (request.method() === 'GET' && request.url() === target) requests++
    })

    let warm = page.waitForResponse(
      (response) =>
        response.url() === target && response.request().headers()['x-remix-frame'] === 'true',
      { timeout: 15_000 },
    )
    await link.hover()
    await warm
    assert.equal(requests, 1, 'the hover must warm exactly one fragment request')

    let mutation = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === mutationPath,
      { timeout: 5_000 },
    )
    await page.evaluate(
      ({ actionUrl, frameTarget }) => {
        let csrf =
          document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content') ?? ''
        let form = document.createElement('form')
        form.method = 'POST'
        form.action = actionUrl
        form.setAttribute('data-rmx-target', frameTarget)

        let payload = document.createElement('input')
        payload.type = 'hidden'
        payload.name = 'payload'
        payload.value = '{'

        let token = document.createElement('input')
        token.type = 'hidden'
        token.name = '_csrf'
        token.value = csrf

        let button = document.createElement('button')
        button.type = 'submit'
        button.textContent = 'Fail mutation'

        form.append(payload, token, button)
        document.body.append(form)
        button.click()
      },
      { actionUrl: mutationPath, frameTarget: frames.adminStats },
    )

    let failed = await mutation
    assert.equal(failed.status(), 503, 'the probe must return the simulated failure')
    await page.getByRole('heading', { name: 'Reload required' }).waitFor({ timeout: 5_000 })

    // The failed POST still invalidates the warm. If it did not, the click would
    // consume the pre-mutation response and issue no fresh GET.
    let fresh = page.waitForRequest(
      (request) =>
        request.method() === 'GET' &&
        request.url() === target &&
        request.headers()['x-remix-frame'] === 'true',
      { timeout: 5_000 },
    )
    await link.click()
    await fresh
    await page.waitForURL((url) => url.pathname === routes.admin.users.index.href(), {
      timeout: 15_000,
    })

    assert.equal(requests, 2, 'the post-mutation navigation must fetch a fresh fragment')
  })
})
