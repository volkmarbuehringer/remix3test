import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../test-router.ts'
import { routes } from '../routes.ts'
import { APP_OVERLAY_ROOT_ID } from './overlay-root.tsx'

describe('shell overlay root', () => {
  it('renders one empty destination outside the page scroller', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page.goto(routes.home.href())

    let state = await page.evaluate((id) => {
      let roots = document.querySelectorAll(`#${id}`)
      let root = roots[0] as HTMLElement | undefined
      return {
        count: roots.length,
        parentIsBody: root?.parentElement === document.body,
        insidePageScroller: Boolean(root?.closest('[data-page-scroller]')),
        childCount: root?.childElementCount ?? -1,
      }
    }, APP_OVERLAY_ROOT_ID)

    assert.equal(state.count, 1, 'the shell renders exactly one overlay destination')
    assert.equal(state.parentIsBody, true, 'the destination sits outside the shell')
    assert.equal(state.insidePageScroller, false, 'the destination never scrolls with the page')
    assert.equal(state.childCount, 0, 'the destination starts empty')
  })
})
