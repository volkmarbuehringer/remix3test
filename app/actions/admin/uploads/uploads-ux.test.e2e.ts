import { describe, it, before, afterEach, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../../test/utils.ts'
import { db, initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../../test/pool.ts'
import { claimUploads, insertUpload } from '../../../data/uploads.ts'

// ---------------------------------------------------------------------------
// /admin/uploads UX contracts that need a real browser:
//
// - live search: typing in the filter runs the GET form after a pause, the grid
//   narrows to the match, and focus stays in the field so typing can continue;
// - phone layout: the page scrolls instead of a ~4-row hole inside a bounded
//   grid, so the whole list is reachable with one scroll gesture.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('admin uploads: UX', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-ux-%'")
  })

  /** Insert + claim one-byte uploads so the assertions never depend on seed data. */
  async function seed(files: [string, string][]): Promise<number[]> {
    let admin = await pool.query("SELECT id FROM users WHERE email = 'admin@newapp.com'")
    let adminId = Number(admin.rows[0]?.id)
    if (!Number.isFinite(adminId)) throw new Error('admin@newapp.com must exist')

    let ids: number[] = []
    for (let [filename, mimeType] of files) {
      let id = Number(
        await insertUpload(db, {
          filename,
          mimeType,
          buffer: Buffer.from('x'),
          size: 1,
          now: Date.now(),
        }),
      )
      ids.push(id)
    }
    let claimed = await claimUploads(db, ids, adminId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim seeded uploads')
    return ids
  }

  async function openUploadsPage(t: TestContext) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.uploads.index.href())
    await page
      .locator('[data-upload-form][data-dropzone-ready="true"]')
      .waitFor({ timeout: 15_000 })
    await page
      .locator('form[data-uploads-filter][data-filter-autosubmit-ready="true"]')
      .waitFor({ timeout: 15_000 })
    return page
  }

  it('filters as you type and keeps focus in the search field', async (t) => {
    await seed([
      ['test-ux-alpha.pdf', 'application/pdf'],
      ['test-ux-beta.png', 'image/png'],
    ])
    let page = await openUploadsPage(t)

    let input = page.locator('form[data-uploads-filter] input[name="filter"]')
    await input.click()
    await input.pressSequentially('test-ux-alpha', { delay: 40 })

    // The debounced submit navigates the frame and commits the GET form URL.
    await page.waitForFunction(
      () => new URL(location.href).searchParams.get('filter') === 'test-ux-alpha',
      undefined,
      { timeout: 15_000 },
    )
    // Wait for the re-rendered grid, not just the URL: the frame swaps its
    // content after committing the navigation.
    await page.waitForFunction(
      () =>
        !!document.querySelector('[data-upload-filename="test-ux-alpha.pdf"]') &&
        !document.querySelector('[data-upload-filename="test-ux-beta.png"]'),
      undefined,
      { timeout: 15_000 },
    )

    assert.equal(
      await page.locator('[data-upload-filename="test-ux-alpha.pdf"]').count(),
      1,
      'the matching upload should stay in the grid',
    )
    assert.equal(
      await page.locator('[data-upload-filename="test-ux-beta.png"]').count(),
      0,
      'the non-matching upload should be filtered out',
    )
    assert.ok(
      await page.evaluate(() =>
        document.activeElement?.matches('form[data-uploads-filter] input[name="filter"]'),
      ),
      'focus must stay in the search field so typing can continue after the reload',
    )
  })

  it('clears a filter that arrived in the URL and reloads the grid', async (t) => {
    await seed([
      ['test-ux-clear-alpha.pdf', 'application/pdf'],
      ['test-ux-clear-zeta.txt', 'text/plain'],
    ])
    let page = await openUploadsPage(t)

    // Arrive with a filter already applied (reload, back/forward, shared link)
    // without typing into the field first.
    await page.goto(routes.admin.uploads.index.href() + '?filter=test-ux-clear-alpha')
    await page
      .locator('[data-upload-form][data-dropzone-ready="true"]')
      .waitFor({ timeout: 15_000 })
    await page.waitForFunction(
      () =>
        !!document.querySelector('[data-upload-filename="test-ux-clear-alpha.pdf"]') &&
        !document.querySelector('[data-upload-filename="test-ux-clear-zeta.txt"]'),
      undefined,
      { timeout: 15_000 },
    )

    let input = page.locator('form[data-uploads-filter] input[name="filter"]')
    await input.click()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('Backspace')

    // Clearing the field must run the live search: the filter leaves the URL and
    // the previously filtered-out row comes back.
    await page.waitForFunction(
      () => !new URL(location.href).searchParams.get('filter'),
      undefined,
      { timeout: 15_000 },
    )
    await page.waitForFunction(
      () => !!document.querySelector('[data-upload-filename="test-ux-clear-zeta.txt"]'),
      undefined,
      { timeout: 15_000 },
    )
    assert.equal(await input.inputValue(), '', 'the cleared field should stay empty')
  })

  it('lets a phone scroll the page instead of a short nested row region', async (t) => {
    await seed(
      Array.from({ length: 10 }, (_, index) => [`test-ux-mobile-${index}.txt`, 'text/plain']) as [
        string,
        string,
      ][],
    )
    let page = await openUploadsPage(t)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('[data-uploads-table]').waitFor({ timeout: 15_000 })
    await page.waitForTimeout(300)

    let layout = await page.evaluate(() => {
      let scroller = document.querySelector('[data-page-scroller]') as HTMLElement
      let rowRegion = document.querySelector('[data-uploads-table]')!.parentElement as HTMLElement
      return {
        pageOverflow: scroller.scrollHeight - scroller.clientHeight,
        rowOverflow: rowRegion.scrollHeight - rowRegion.clientHeight,
        rowOverflowY: getComputedStyle(rowRegion).overflowY,
      }
    })

    assert.ok(layout.pageOverflow > 0, `the page should scroll, got ${layout.pageOverflow}`)
    assert.ok(
      layout.rowOverflow <= 1,
      `the row region must not scroll on its own, got ${layout.rowOverflow}`,
    )
    assert.equal(layout.rowOverflowY, 'visible', 'the row region should not clip its rows')
  })
})
