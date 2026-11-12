import { before, describe, it, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import type { Locator, Page } from 'playwright'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

async function openDisplayTab(t: TestContext): Promise<Page> {
  let auth = await createAuthCookieWithCsrfForUser('user@newapp.com')
  assert.ok(auth?.cookie, 'user session must be created')

  let server = await createTestServer((request) => router.fetch(request))
  let page = await t.serve(server)
  await page
    .context()
    .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

  await page.goto(routes.settings.index.href() + '?tab=display')
  return page
}

/**
 * The client entries attach after hydration. Wait for their client-only
 * markers, then drive the select once and wait for the synced input.
 */
async function selectOnce(page: Page, select: Locator, value: string, expected: string) {
  await page
    .locator('#page-size-select[data-page-size-sync-ready="true"]')
    .waitFor({ state: 'attached', timeout: 15_000 })
  await page
    .locator('#page-size-custom[data-page-size-keys-ready="true"]')
    .waitFor({ state: 'attached', timeout: 15_000 })
  await select.selectOption(value)
  await page.waitForFunction(
    (want: string) =>
      (document.querySelector('#page-size-custom') as HTMLInputElement | null)?.value === want,
    expected,
    { timeout: 15_000 },
  )
}

describe('settings: page-size keyboard stepping', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('select syncs fine-tuning; PageUp/PageDown jump presets; arrows stay fine', async (t) => {
    let page = await openDisplayTab(t)
    let select = page.locator('#page-size-select')
    let input = page.locator('#page-size-custom')
    await input.waitFor({ timeout: 15_000 })

    await selectOnce(page, select, '50', '50')
    assert.equal(await input.inputValue(), '50', 'selecting a preset must fill the custom input')

    await input.press('ArrowUp')
    assert.equal(await input.inputValue(), '51', 'arrows must fine-tune from the selected preset')

    await input.press('ArrowDown')
    assert.equal(await input.inputValue(), '50')

    await input.fill('')
    await select.focus()
    await input.focus()
    assert.equal(await input.inputValue(), '50', 'focus must prefill from the selected preset')

    await input.press('PageUp')
    assert.equal(await input.inputValue(), '100', 'PageUp must jump to the next preset')

    await input.press('PageDown')
    assert.equal(await input.inputValue(), '50', 'PageDown must jump to the previous preset')

    await input.press('End')
    assert.equal(await input.inputValue(), '100', 'End must jump to the maximum')

    await input.press('Home')
    assert.equal(await input.inputValue(), '5', 'Home must jump to the minimum')

    await input.press('ArrowUp')
    assert.equal(await input.inputValue(), '6', 'arrows must still step by 1')
  })
})
