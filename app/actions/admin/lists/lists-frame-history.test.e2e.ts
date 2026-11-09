import { describe, it, before, afterEach, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import type { Page } from 'playwright'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser, isFirefox } from '../../../../test/utils.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../../test/pool.ts'

// ---------------------------------------------------------------------------
// Frame-navigation history contracts that need a real browser:
//
// - #12240: a push navigation commits its Navigation API history entry before
//   the frame response renders. A second navigation that interrupts it must
//   replace that unrendered entry, so Back returns to the page the visitor
//   actually saw instead of a URL that never rendered.
// - `data-rmx-history="replace"` GET filter forms must replace the current
//   entry instead of stacking one per search.
//
// Both paths are exercised through the app's custom `resolveFrame` (agent
// prefill, error cards, prefetch cache), which upstream component tests do not
// cover. The first test holds the first editor response open with `page.route`
// and supersedes it with the second row's click.
//
// Firefox: the strict assertions use `window.navigation.entries()` and the
// precommit replace path, which are Chromium-only on this build; Firefox keeps
// a smoke check that a row editor still opens.
// ---------------------------------------------------------------------------

describe('admin lists: frame navigation history', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM lists WHERE description LIKE 'test-nav-history-%'")
  })

  async function seedList(description: string): Promise<{ id: number; title: string }> {
    let title = 'Navigation ' + description
    let inserted = await pool.query(
      `INSERT INTO lists (title, description, list, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $4)
       RETURNING id`,
      [title, description, JSON.stringify([]), Date.now()],
    )
    return { id: inserted.rows[0].id as number, title }
  }

  async function openListsPage(t: TestContext, filter?: string) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    let url = routes.admin.lists.index.href()
    if (filter) url += '?filter=' + encodeURIComponent(filter)
    await page.goto(url)
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })
    await page
      .locator('form[data-lists-filter][data-filter-autosubmit-ready="true"]')
      .waitFor({ timeout: 15_000 })
    return page
  }

  function editorLink(page: Page, id: number) {
    return page.locator(`[data-row-id="${id}"] [aria-label*="bearbeiten"]`)
  }

  it('replaces the entry of an interrupted editor navigation', async (t) => {
    let token = 'test-nav-history-' + Date.now()
    let first = await seedList(token + '-first')
    let second = await seedList(token + '-second')
    let page = await openListsPage(t, token)

    if (isFirefox(page)) {
      // Chromium-only Navigation API history assertions (see header).
      await page.locator(`[data-row-id="${first.id}"]`).hover()
      await editorLink(page, first.id).click()
      await page.waitForFunction(
        (id) => new URL(location.href).searchParams.get('editing') === id,
        String(first.id),
        { timeout: 15_000 },
      )
      await page.locator('#al-title').waitFor({ timeout: 15_000 })
      return
    }

    let loads = 0
    page.on('load', () => {
      loads++
    })

    let releaseFirst!: () => void
    let firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    await page.route(
      (url) =>
        url.pathname === '/admin/lists' && url.searchParams.get('editing') === String(first.id),
      async (route) => {
        await firstGate
        // The navigation that owns this request is aborted by the interruption.
        await route.continue().catch(() => {})
      },
    )

    try {
      let firstRequest = page.waitForRequest(
        (request) => {
          let url = new URL(request.url())
          return (
            url.pathname === '/admin/lists' && url.searchParams.get('editing') === String(first.id)
          )
        },
        { timeout: 15_000 },
      )

      await page.locator(`[data-row-id="${first.id}"]`).hover()
      await editorLink(page, first.id).click({ noWaitAfter: true })
      await firstRequest

      // The first editor response is still held open, so the grid is still on
      // screen and the second row link is clickable. This starts the
      // navigation that must replace the first push's unrendered entry.
      await page.locator(`[data-row-id="${second.id}"]`).hover()
      await editorLink(page, second.id).click({ noWaitAfter: true })

      await page.waitForFunction(
        (id) => new URL(location.href).searchParams.get('editing') === id,
        String(second.id),
        { timeout: 15_000 },
      )
      await page.locator('#al-title').waitFor({ timeout: 15_000 })
      assert.equal(
        await page.locator('#al-title').inputValue(),
        second.title,
        'the second editor must render',
      )
      assert.equal(loads, 0, 'both editor navigations must stay inside the frame')

      let entries = await page.evaluate(() =>
        window.navigation.entries().map((entry) => entry.url ?? ''),
      )
      let unrenderedEntry = entries.find(
        (url) => new URL(url).searchParams.get('editing') === String(first.id),
      )
      assert.equal(
        unrenderedEntry,
        undefined,
        `the interrupted navigation must not keep a history entry; entries: ${entries.join(', ')}`,
      )

      // Back must return to the grid the visitor actually saw, not the first
      // editor URL that never rendered.
      await page.goBack()
      await page.waitForFunction(
        () => !new URL(location.href).searchParams.get('editing'),
        undefined,
        {
          timeout: 15_000,
        },
      )
      await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })
      assert.equal(new URL(page.url()).searchParams.get('filter'), token)
    } finally {
      releaseFirst()
    }
  })

  it('replaces the history entry for a marked GET filter form', async (t) => {
    let page = await openListsPage(t)

    if (isFirefox(page)) {
      let marker = 'replace-history-' + Date.now()
      let input = page.locator('form[data-lists-filter] input[name="filter"]')
      await input.fill(marker)
      await input.press('Enter')
      await page.waitForFunction(
        (expected) => new URL(location.href).searchParams.get('filter') === expected,
        marker,
        { timeout: 15_000 },
      )
      return
    }

    let entryCountBefore = await page.evaluate(() => window.history.length)
    let marker = 'replace-history-' + Date.now()

    // Set the value without dispatching `input`, so the live-search debounce
    // cannot race the explicit submit.
    await page.evaluate((value) => {
      let form = document.querySelector<HTMLFormElement>('form[data-lists-filter]')
      let input = form?.querySelector<HTMLInputElement>('input[name="filter"]')
      if (!form || !input) throw new Error('the lists filter form must render')
      input.value = value
      form.requestSubmit()
    }, marker)
    await page.waitForFunction(
      (expected) => new URL(location.href).searchParams.get('filter') === expected,
      marker,
      { timeout: 15_000 },
    )
    await page.waitForFunction(() => window.navigation.transition === null, undefined, {
      timeout: 15_000,
    })

    assert.equal(
      await page.evaluate(() => window.history.length),
      entryCountBefore,
      'data-rmx-history="replace" must not stack a history entry per filter submit',
    )
  })
})
