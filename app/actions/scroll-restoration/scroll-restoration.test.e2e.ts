import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'

// ---------------------------------------------------------------------------
// Frame traversal scroll-restoration E2E
//
// Requires a running PostgreSQL database (the app middleware loads one) and a
// Playwright browser. Drives the reproduction defined in this directory: a
// top-level client entry switches between a tall frame-backed collection and a
// short detail. Using the browser Back button must restore the prior scroll
// position even though the client-entry reconciliation shrinks the document.
// ---------------------------------------------------------------------------

describe('scroll restoration', () => {
  it('restores traversal scroll when client entry reconciliation shrinks the document', async (t) => {
    let page = await t.serve(
      await createTestServer((request) => router.fetch(request)),
    )
    await page.goto(routes.scrollRestoration.index.href())

    let reproduction = page.locator('#store-scroll-reproduction')
    let hydrationCheck = reproduction.getByRole('button', {
      name: 'Hydration check: 0',
      exact: true,
    })
    await hydrationCheck.waitFor()
    await hydrationCheck.click()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()

    // Scroll the tall collection into view and record the offset.
    await page.locator('#scroll-restoration-list-end').scrollIntoViewIfNeeded()
    let scrollPosition = await page.evaluate(() => window.scrollY)

    await page.getByRole('link', { name: 'Open the shorter detail page' }).click()
    await page.getByRole('heading', { name: 'Short detail view' }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()

    await page.evaluate(() => window.scrollTo(0, 500))
    let detailScrollPosition = await page.evaluate(() => window.scrollY)
    assert.ok(
      detailScrollPosition > 100,
      `Expected the detail page to scroll, got ${detailScrollPosition}`,
    )

    await Promise.all([
      page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            window.navigation.addEventListener('navigatesuccess', () => resolve(), { once: true })
          }),
      ),
      page.goBack(),
    ])

    // The collection frame re-renders and the pre-navigation scroll is restored.
    await page.getByText('List row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    let restoredPosition = await page.evaluate(() => window.scrollY)

    assert.ok(
      Math.abs(restoredPosition - scrollPosition) < 50,
      `Expected traversal to restore ${scrollPosition}, got ${restoredPosition}`,
    )
  })
})
