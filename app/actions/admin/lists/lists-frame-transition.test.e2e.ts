import { describe, it, before, afterEach, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import type { Page } from 'playwright'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../../test/utils.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../../test/pool.ts'

// ---------------------------------------------------------------------------
// Admin lists grid ⇄ editor View Transition (app/assets/frame-transition.browser.ts)
//
// The row editor link is the one measured frame-commit candidate: it swaps the
// admin-content fragment between the grid and the edit panel with a push
// navigation whose `editing` parameter toggles. This drives the real runtime
// through `defaultResolveFrame(..., { commit })` and asserts:
//
// - the fragment navigation stays in-frame (no document load),
// - exactly one `document.startViewTransition` starts when the platform has the
//   API, and none when it does not (progressive enhancement),
// - the scoped name and `data-frame-transition` root gate are removed when the
//   transition finishes,
// - closing the panel starts a second transition (the flow is symmetric).
//
// The animation itself is not pixel-asserted; the browser test covers the
// decision/fallback matrix and the no-stall contract.
// ---------------------------------------------------------------------------

type FrameTransitionProbe = {
  supported: boolean
  started: number
  finished: number
}

declare global {
  interface Window {
    __frameTransitionProbe?: FrameTransitionProbe
  }
}

describe('admin lists: frame View Transition', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM lists WHERE description LIKE 'test-frame-transition-%'")
  })

  async function seedList(description: string): Promise<{ id: number; title: string }> {
    let title = 'Transition ' + description
    let inserted = await pool.query(
      `INSERT INTO lists (title, description, list, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $4)
       RETURNING id`,
      [title, description, JSON.stringify([]), Date.now()],
    )
    return { id: inserted.rows[0].id as number, title }
  }

  async function openListsPage(t: TestContext, filter: string): Promise<Page> {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    // Runs before the app runtime: count the transitions the resolver starts
    // and observe when each one settles.
    await page.addInitScript(() => {
      let proto = Document.prototype as unknown as {
        startViewTransition?: (update: () => void | Promise<void>) => {
          finished: Promise<void>
        }
      }
      let original = proto.startViewTransition
      let counters: FrameTransitionProbe = {
        supported: typeof original === 'function',
        started: 0,
        finished: 0,
      }
      window.__frameTransitionProbe = counters
      if (typeof original !== 'function') return
      let start = original
      proto.startViewTransition = function (update) {
        counters.started++
        let transition = start.call(document, update)
        let settle = () => {
          counters.finished++
        }
        transition.finished.then(settle, settle)
        return transition
      }
    })

    await page.goto(routes.admin.lists.index.href() + '?filter=' + encodeURIComponent(filter))
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })
    return page
  }

  function editorLink(page: Page, id: number) {
    return page.locator(`[data-row-id="${id}"] [aria-label*="bearbeiten"]`)
  }

  async function probe(page: Page): Promise<FrameTransitionProbe> {
    let value = await page.evaluate(() => window.__frameTransitionProbe)
    assert.ok(value, 'the init-script probe must be installed')
    return value
  }

  async function transitionSettled(page: Page, expected: number): Promise<void> {
    await page.waitForFunction(
      (count) => (window.__frameTransitionProbe?.finished ?? 0) >= count,
      expected,
      { timeout: 15_000 },
    )
  }

  it('animates the editor swap and cleans up the scoped transition state', async (t) => {
    let token = 'test-frame-transition-' + Date.now()
    let row = await seedList(token)
    let page = await openListsPage(t, token)

    let loads = 0
    page.on('load', () => {
      loads++
    })

    let initial = await probe(page)
    assert.equal(initial.started, 0)

    await page.locator(`[data-row-id="${row.id}"]`).hover()
    await editorLink(page, row.id).click()

    await page.waitForFunction(
      (id) => new URL(location.href).searchParams.get('editing') === id,
      String(row.id),
      { timeout: 15_000 },
    )
    await page.locator('#al-title').waitFor({ timeout: 15_000 })
    assert.equal(await page.locator('#al-title').inputValue(), row.title)

    let supported = (await probe(page)).supported
    if (supported) await transitionSettled(page, 1)

    let afterOpen = await probe(page)
    assert.equal(
      afterOpen.started,
      supported ? 1 : 0,
      'the editor swap must start exactly one transition where the platform supports it',
    )
    assert.equal(loads, 0, 'the editor must commit inside the admin-content frame')

    if (supported) {
      // `finished` resolves before the browser is ready to start the next
      // same-document transition; give it a paint so the close click cannot
      // race a still-active transition (which would fall back to a plain commit).
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          }),
      )
    }
    let settledState = await page.evaluate(() => ({
      rootGate: document.documentElement.hasAttribute('data-frame-transition'),
      named: Array.from(
        document.querySelectorAll<HTMLElement>('[data-frame-transition-region]'),
      ).filter((region) => region.style.viewTransitionName !== '').length,
    }))
    assert.equal(settledState.rootGate, false, 'the root-snapshot gate must be removed')
    assert.equal(settledState.named, 0, 'the transition name must not linger on the region')

    // Closing the panel is the same flow in reverse. The grid table is still on
    // screen next to the editor, so wait for the panel to detach and the second
    // transition to settle before reading the probe.
    await page.locator('a[aria-label="Editor schließen"]').click()
    await page.waitForFunction(
      () => !new URL(location.href).searchParams.get('editing'),
      undefined,
      { timeout: 15_000 },
    )
    await page.locator('#al-title').waitFor({ state: 'detached', timeout: 15_000 })
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })
    if (supported) await transitionSettled(page, 2)

    let afterClose = await probe(page)
    assert.equal(
      afterClose.started,
      supported ? 2 : 0,
      `closing the panel must start the second transition; probe=${JSON.stringify(afterClose)}`,
    )
    assert.equal(loads, 0, 'closing the editor must stay inside the frame')
  })
})
