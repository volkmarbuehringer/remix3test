import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../test-router.ts'
import { routes } from '../routes.ts'
import { APP_OVERLAY_ROOT_ID } from './overlay-root.tsx'
import { TOAST_EVENT } from './toast.ts'

describe('shell toast host', () => {
  it('renders a dispatched toast inside the overlay root', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page.goto(routes.home.href())

    await page.locator('[data-toast-host-ready]').waitFor({ state: 'attached', timeout: 15_000 })
    await page.evaluate((eventName) => {
      document.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { message: 'E2E Toast', tone: 'success' },
        }),
      )
    }, TOAST_EVENT)

    let container = page.locator('#__toast-root')
    await container.waitFor({ timeout: 5_000 })
    let state = await container.evaluate((element) => {
      let toast = element.firstElementChild
      return {
        parentId: element.parentElement?.id,
        text: toast?.textContent,
        role: toast?.getAttribute('role'),
      }
    })

    assert.equal(state.parentId, APP_OVERLAY_ROOT_ID, 'the toast viewport uses the shell root')
    assert.equal(state.text, 'E2E Toast')
    assert.equal(state.role, 'status', 'success toasts are polite live regions')
  })
})
