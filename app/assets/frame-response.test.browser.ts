import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { resolveFrameResponse } from './frame-response.browser.tsx'

// ---------------------------------------------------------------------------
// resolveFrameResponse — redirect handling on frame reload
//
// These tests run in a real browser and verify the observable contract of a
// frame reload whose server response redirects:
//
//   - redirect + target   → the promise never settles, so the frame runtime
//     never receives document UI to inject into the subframe (top-frame
//     navigation is handled by the caller via `window.location.assign`)
//   - redirect, no target → the response is returned unchanged (subframe flow)
//   - plain 200           → the response is returned unchanged
//
// `window.location.assign` itself is a non-configurable own property of the
// Location object, so it cannot be stubbed in the harness; the never-settling
// promise is the observable proof that the redirect-bail branch ran.
// ---------------------------------------------------------------------------

let originalFetch: typeof window.fetch | undefined

function stubFetch(response: Partial<Response>) {
  originalFetch = window.fetch
  window.fetch = (async () => response) as typeof window.fetch
}

afterEach(() => {
  if (originalFetch) {
    window.fetch = originalFetch
    originalFetch = undefined
  }
})

async function assertNeverSettles(promise: Promise<unknown>): Promise<void> {
  let settled = false
  promise.then(
    () => {
      settled = true
    },
    () => {
      settled = true
    },
  )
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.ok(!settled, 'expected the promise to never settle (no document UI injected)')
}

describe('resolveFrameResponse redirect handling', () => {
  it('never settles when a frame reload response redirects with a target', async () => {
    stubFetch({ redirected: true, ok: true, url: 'https://remix.run/login', status: 200 })

    let result = resolveFrameResponse(new URL('https://remix.run/admin/client'), {
      target: 'admin-content',
    })

    await assertNeverSettles(result)
  })

  it('does not return the redirected document for the subframe', async () => {
    stubFetch({
      redirected: true,
      ok: true,
      url: 'https://remix.run/login',
      status: 200,
      text: async () => '<html><body>Login page</body></html>',
    })

    let result = resolveFrameResponse(new URL('https://remix.run/admin/client'), {
      target: 'admin-content',
    })

    await assertNeverSettles(result)
  })

  it('returns the response for a redirect without a frame target', async () => {
    let response = {
      redirected: true,
      ok: true,
      url: 'https://remix.run/elsewhere',
      status: 200,
    } as Response
    stubFetch(response)

    let result = await resolveFrameResponse(new URL('https://remix.run/admin/client'))

    assert.equal(result, response, 'should return the response unchanged (subframe flow)')
  })

  it('returns a normal 200 response inside the subframe', async () => {
    let response = {
      redirected: false,
      ok: true,
      url: 'https://remix.run/admin/client',
      status: 200,
      text: async () => '<div>Grid content</div>',
    } as Response
    stubFetch(response)

    let result = await resolveFrameResponse(new URL('https://remix.run/admin/client'), {
      target: 'admin-content',
    })

    assert.equal(result, response, 'should return the 200 response for subframe rendering')
  })
})
