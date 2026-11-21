import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../test-router.ts'
import { routes } from '../routes.ts'

describe('root browser error handling', () => {
  it('renders the fatal card for an unhandled promise rejection', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page.goto(routes.auth.login.index.href())

    // The page-scroll entry only stamps this after the client runtime and its
    // entries are live, so the unhandled rejection cannot race the entry module.
    await page
      .locator('html[data-page-scroll-reset-ready="true"]')
      .waitFor({ state: 'attached', timeout: 15_000 })

    await page.evaluate(() => {
      void Promise.reject(new Error('unhandled rejection probe'))
    })

    await page.getByRole('heading', { name: 'Something went wrong' }).waitFor({ timeout: 15_000 })

    let body = await page.locator('body').innerText()
    assert.ok(body.includes('unhandled rejection probe'), 'the original reason stays visible')
    assert.ok(body.includes('Reload the page'), 'the fatal card offers a recovery action')
  })
})
