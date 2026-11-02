import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { isFirefox } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// Frame traversal scroll-restoration E2E
//
// Requires a running PostgreSQL database (the app middleware loads one) and a
// Playwright browser. Drives the reproduction defined in this directory: a
// top-level client entry switches between a tall frame-backed collection and a
// short detail. Using the browser Back button must restore the prior scroll
// position even though the client-entry reconciliation shrinks the document.
//
// Firefox: the top-level client entry's click handler does not fire (a remix-ui
// runtime bug — the button renders but `on('click')` never increments state, no
// console error). The full interaction is therefore scoped to Chromium; Firefox
// still runs a page-load smoke check so the page is verified not to crash.
// Tracked as a known remix-ui Firefox incompatibility; revisit when the vendor
// fixes delegated event handling in Firefox.
// ---------------------------------------------------------------------------

describe('scroll restoration', () => {
  it('restores traversal scroll when client entry reconciliation shrinks the document', async (t) => {
    let page = await t.serve(await createTestServer((request) => router.fetch(request)))
    await page.goto(routes.scrollRestoration.index.href())

    let reproduction = page.locator('#store-scroll-reproduction')
    let hydrationCheck = reproduction.getByRole('button', {
      name: 'Hydration check: 0',
      exact: true,
    })
    await hydrationCheck.waitFor()

    if (isFirefox(page)) {
      // Firefox-scoped smoke check: the top-level client entry SSR-renders and
      // the collection frame loads, but the click handler is broken by a
      // remix-ui Firefox bug (see header). Keep this so Firefox still exercises
      // the page without asserting the broken interaction.
      await page.getByText('List row 48', { exact: true }).waitFor()
      assert.ok(
        (await page.locator('#scroll-restoration-list').count()) >= 1,
        'collection frame should render in Firefox',
      )
      return
    }

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

  it('restores forward traversal scroll after a replace navigation with resetScroll=false', async (t) => {
    let page = await t.serve(await createTestServer((request) => router.fetch(request)))
    await page.goto(routes.scrollRestoration.index.href())

    let reproduction = page.locator('#store-scroll-reproduction')
    let hydrationCheck = reproduction.getByRole('button', {
      name: 'Hydration check: 0',
      exact: true,
    })
    await hydrationCheck.waitFor()

    if (isFirefox(page)) {
      // Same remix-ui Firefox click-handler limitation as the first test; keep
      // a page-load smoke check so the project is still exercised.
      await page.getByText('List row 48', { exact: true }).waitFor()
      return
    }

    await hydrationCheck.click()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()

    await page.locator('#scroll-restoration-list-end').scrollIntoViewIfNeeded()
    let listScrollPosition = await page.evaluate(() => window.scrollY)
    assert.ok(
      listScrollPosition > 1000,
      `Expected the list page to scroll far down, got ${listScrollPosition}`,
    )

    await page.getByRole('link', { name: 'Open the shorter detail page' }).click()
    await page.getByRole('heading', { name: 'Short detail view' }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(() => window.navigation.transition === null)

    await page.evaluate(() => window.scrollTo(0, 150))
    let detailScrollPosition = await page.evaluate(() => window.scrollY)
    assert.equal(detailScrollPosition, 150)

    await page.getByRole('button', { name: 'Replace the URL without resetting scroll' }).click()
    await page.waitForURL((url) => url.searchParams.get('replaced') === '1')
    await page.waitForFunction(() => window.navigation.transition === null)
    assert.equal(
      await page.evaluate(() => window.scrollY),
      detailScrollPosition,
      'the replace navigation must keep the current scroll position',
    )
    // Version-pinned vendor state shape (remix 3.1.0); the scroll assertion
    // above is the authoritative behaviour check.
    assert.equal(
      await page.evaluate(() => {
        let state = window.navigation.currentEntry?.getState()
        return typeof state === 'object' && state !== null && 'resetScroll' in state
          ? state.resetScroll
          : undefined
      }),
      'manual',
      'resetScroll=false is represented as a manual reset policy',
    )

    await page.goBack()
    await page.getByText('List row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(
      ({ expected, tolerance }) => Math.abs(window.scrollY - expected) < tolerance,
      { expected: listScrollPosition, tolerance: 50 },
    )

    await page.goForward()
    await page.getByRole('heading', { name: 'Short detail view' }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(
      ({ expected, tolerance }) =>
        window.navigation.transition === null && Math.abs(window.scrollY - expected) < tolerance,
      { expected: detailScrollPosition, tolerance: 50 },
    )

    // The restored position must survive the frames in which the page shrinks to its own height.
    let detailRestoredPosition = await page.evaluate(
      () =>
        new Promise<number>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.scrollY))),
        ),
    )
    assert.ok(
      Math.abs(detailRestoredPosition - detailScrollPosition) < 50,
      `Expected forward traversal to restore detail scroll ${detailScrollPosition}, got ${detailRestoredPosition}`,
    )
  })
})
