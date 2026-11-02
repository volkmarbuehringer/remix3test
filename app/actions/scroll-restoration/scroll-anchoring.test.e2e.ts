import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { isFirefox } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// Frame traversal scroll-anchoring E2E
//
// The detail page inserts a detail-only client entry *before* the preserved
// collection entry. When Chromium reconciles the list page on traversal it can
// select that inserted content as a scroll anchor, fighting the runtime's
// restoration. The reproduction lives at /scroll-restoration/anchoring.
//
// Firefox is scoped to a page-load smoke check for the same remix-ui click
// limitation documented in scroll-restoration.test.e2e.ts.
// ---------------------------------------------------------------------------

describe('scroll anchoring', () => {
  it('restores traversal scroll after an earlier client entry is removed', async (t) => {
    let page = await t.serve(await createTestServer((request) => router.fetch(request)))
    await page.goto(routes.scrollRestoration.anchoring.href())

    let reproduction = page.locator('#scroll-anchoring-reproduction')
    let hydrationCheck = reproduction.getByRole('button', {
      name: 'Hydration check: 0',
      exact: true,
    })
    await hydrationCheck.waitFor()

    if (isFirefox(page)) {
      // Same remix-ui Firefox click-handler limitation as the scroll-restoration
      // suite: keep a page-load smoke check rather than skipping the project.
      await page.getByText('Anchoring row 48', { exact: true }).waitFor()
      assert.ok(
        (await page.locator('#scroll-anchoring-list').count()) >= 1,
        'the anchoring collection should render in Firefox',
      )
      return
    }

    await hydrationCheck.click()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()

    await page.locator('#scroll-anchoring-list-end').scrollIntoViewIfNeeded()
    let scrollPosition = await page.evaluate(() => window.scrollY)

    await page.getByRole('link', { name: 'Open the anchoring detail page' }).click()
    await page.getByRole('heading', { name: 'Scroll anchoring detail' }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()

    await page.evaluate(() => window.scrollTo(0, 500))
    let detailScrollPosition = await page.evaluate(() => window.scrollY)
    assert.ok(
      detailScrollPosition > 100,
      `Expected the detail page to scroll, got ${detailScrollPosition}`,
    )

    await page.goBack()
    await page.getByText('Anchoring row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(
      ({ expected, tolerance }) => Math.abs(window.scrollY - expected) < tolerance,
      { expected: scrollPosition, tolerance: 50 },
    )

    let restoredPosition = await page.evaluate(() => window.scrollY)
    assert.ok(
      Math.abs(restoredPosition - scrollPosition) < 50,
      `Expected traversal to restore ${scrollPosition}, got ${restoredPosition}`,
    )
  })
})
