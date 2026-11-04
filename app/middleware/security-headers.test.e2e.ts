import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../test-router.ts'
import { routes } from '../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../test/utils.ts'
import { initializeAppDatabase } from '../db.ts'
import { pool } from '../../test/pool.ts'
import { installCspViolationCollector } from '../../test/csp.ts'

// ---------------------------------------------------------------------------
// CSP enforcement in real browsers.
//
// Style guard: the policy gates <style> elements with the request nonce while
// keeping inline style attributes, so every authored/theme style element must
// carry the header nonce. These loads fail on any securitypolicyviolation.
//
// No-eval guard: the Firefox multiple-import-maps polyfill used to need
// 'unsafe-eval' / 'wasm-unsafe-eval': its es-module-lexer path compiled Wasm
// and fell back to eval. Since remix #12059 (build 57ecca4cba) the polyfill
// imports `es-module-lexer/minimal/js`, a pure asm.js build with no
// eval/WebAssembly. The client-entry page (the admin messages grid) fails on
// any securitypolicyviolation, so a future dependency reintroducing eval is
// visible in both browsers — Firefox is the one that exercises the polyfill.
//
// Route matrix: every representative full document (anonymous and admin, plus
// the frame-based panels) and one in-frame PRG follow are loaded with the
// shared `installCspViolationCollector()` helper from `test/csp.ts`. The
// playwright projects in `playwright.config.ts` run each test in Chromium and
// Firefox.
// ---------------------------------------------------------------------------

describe('CSP enforcement', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('loads authored and theme styles without CSP violations', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    let csp = await installCspViolationCollector(page)

    // The landing page adds HomeStyles; the login page renders the document
    // shell plus both theme style elements.
    for (let path of [routes.home.href(), routes.auth.login.index.href()]) {
      await page.goto(path)
      await page.waitForTimeout(1_000)
      await csp.assertNone(path)
    }
  })

  it('hydrates a client-entry page without CSP violations', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
    let csp = await installCspViolationCollector(page)

    // The notification bell is a client entry; its unread-count fetch is the
    // hydration signal used by the other admin e2e tests.
    let hydrated = page.waitForResponse(
      (response) => response.url().includes('/notifications/unread-count'),
      { timeout: 15_000 },
    )
    await page.goto(routes.admin.messages.index.href())
    await page.locator('[data-messages-table]').waitFor({ timeout: 15_000 })
    await hydrated
    // Let deferred client entries load through the polyfill (Firefox).
    await page.waitForTimeout(1_000)

    await csp.assertNone(routes.admin.messages.index.href())
  })

  it('loads the route matrix without CSP violations', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    let csp = await installCspViolationCollector(page)

    for (let path of [routes.home.href(), routes.auth.login.index.href()]) {
      await page.goto(path)
      await page.waitForTimeout(1_000)
      await csp.assertNone(path)
    }

    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    // Each admin route renders a different frame shape: grid pages, the
    // appointments wizard (blocking frame), and the SSE-backed support agent.
    let adminRoutes: ReadonlyArray<readonly [string, string]> = [
      [routes.admin.messages.index.href(), '[data-messages-table]'],
      [routes.admin.lists.index.href(), '[data-lists-table]'],
      [routes.admin.uploads.index.href(), '[data-kind-tabs]'],
      [routes.appointmentsNew.index.href(), 'a[data-rmx-target="appointments-new-content"]'],
      [routes.admin.supportAgent.index.href(), '#chat-messages'],
    ]

    for (let [path, ready] of adminRoutes) {
      await page.goto(path)
      await page.locator(ready).first().waitFor({ timeout: 15_000 })
      // Give deferred client entries and their `connect-src` traffic a beat.
      await page.waitForTimeout(1_000)
      await csp.assertNone(path)
    }
  })

  it('follows a lists copy PRG in-frame without CSP violations', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let adminRows = (
      await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com'])
    ).rows as { id: number }[]
    assert.ok(adminRows.length > 0, 'admin user must exist')

    let title = `csp matrix ${crypto.randomUUID()}`
    let inserted = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [
        adminRows[0]!.id,
        title,
        'seeded for the CSP PRG matrix',
        JSON.stringify([{ id: crypto.randomUUID(), label: 'Eintrag' }]),
        Date.now(),
      ],
    )
    let listId = Number(inserted.rows[0]!.id as number)

    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
      let csp = await installCspViolationCollector(page)

      await page.goto(`/lists?load=${listId}`)
      await page.locator('#lists-title').waitFor({ timeout: 15_000 })

      // Every document load after this point is a failure: the copy POST must be
      // intercepted by the frame runtime and its 302 followed by frameRedirects.
      let documentLoads = 0
      page.on('load', () => documentLoads++)

      let rowsBefore = await page.locator('[data-list-id]').count()

      // Submit the hidden copy form the way the toolbar button does, but without
      // depending on the lists client entry having hydrated: the runtime's
      // Navigation API interception (installed by `run()`, before `load`) reads
      // `data-rmx-target` straight from the form.
      await page.evaluate(() => {
        let form = document.querySelector('form[action$="/copy"]')
        if (!(form instanceof HTMLFormElement)) throw new Error('lists copy form is missing')
        let token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
        let csrf = form.querySelector('input[name="_csrf"]')
        if (csrf instanceof HTMLInputElement) csrf.value = token
        form.requestSubmit()
      })

      // The followed PRG renders the new list into the sidebar fragment.
      await page.waitForFunction(
        (rows) => document.querySelectorAll('[data-list-id]').length > rows,
        rowsBefore,
        { timeout: 15_000 },
      )
      await page.waitForTimeout(1_000)

      assert.equal(
        documentLoads,
        0,
        'the copy must be followed in-frame; a document load means frameRedirects was bypassed',
      )
      await csp.assertNone('lists copy PRG')
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
      await pool.query('DELETE FROM lists WHERE title = $1', [`${title} (Kopie)`])
    }
  })
})
