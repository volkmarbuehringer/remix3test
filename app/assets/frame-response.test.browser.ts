import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { resolveFrameResponse, isSameOriginFrameSource } from './frame-response.browser.tsx'

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
//   - cross-origin source → rejected by `isSameOriginFrameSource` (asserted directly:
//     the branch itself calls `window.location.assign`, which cannot be exercised in a
//     real browser test without navigating the test page away)
//
// `window.location.assign` itself is a non-configurable own property of the
// Location object, so it cannot be stubbed in the harness; the never-settling
// promise is the observable proof that the redirect-bail branch ran.
// ---------------------------------------------------------------------------

let originalFetch: typeof window.fetch | undefined
let lastFetchInit: RequestInit | undefined

function stubFetch(response: Partial<Response>) {
  originalFetch = window.fetch
  lastFetchInit = undefined
  window.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    lastFetchInit = init
    return response
  }) as typeof window.fetch
}

afterEach(() => {
  if (originalFetch) {
    window.fetch = originalFetch
    originalFetch = undefined
  }
  lastFetchInit = undefined
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

    let result = resolveFrameResponse(new URL('/admin/client', window.location.origin), {
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

    let result = resolveFrameResponse(new URL('/admin/client', window.location.origin), {
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

    let result = await resolveFrameResponse(new URL('/admin/client', window.location.origin))

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

    let result = await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    assert.equal(result, response, 'should return the 200 response for subframe rendering')
  })

  it('renders a 4xx response body so validation errors show in the frame', async () => {
    let response = {
      redirected: false,
      ok: false,
      url: 'https://remix.run/admin/client',
      status: 400,
      text: async () => '<div>slot outside booking hours</div>',
    } as Response
    stubFetch(response)

    let result = await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    // 4xx is an intended validation/not-found fragment — return it so the frame
    // renders the inline error instead of the generic crash card.
    assert.equal(result, response, 'should return the 4xx response for subframe rendering')
  })

  it('shows the reload card for a 5xx server error', async () => {
    let response = {
      redirected: false,
      ok: false,
      url: 'https://remix.run/admin/client',
      status: 500,
      text: async () => '<div>boom</div>',
    } as Response
    stubFetch(response)

    let result = await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    // 5xx is a genuine server error — discard the body and surface the reload card.
    assert.ok(result !== response, 'should not return the crash body for a 5xx')
  })

  it('only resolves same-origin frame sources', () => {
    // Frame HTML is trusted content (it can select client-entry modules and contribute
    // import maps), so the custom resolver refuses cross-origin sources the way the
    // runtime's default `resolveFrame` does (remix #11849). Asserted on the predicate
    // rather than through resolveFrameResponse: the cross-origin branch calls
    // `window.location.assign`, which navigates a real browser test page away and hangs
    // the runner (see the playbook on unforgeable window.location).
    assert.ok(isSameOriginFrameSource(new URL('/admin/client', window.location.origin)))
    assert.equal(isSameOriginFrameSource(new URL('https://evil.example/admin/client')), false)
  })
})

// ---------------------------------------------------------------------------
// resolveFrameResponse — request body encoding (remix #11938)
//
// The custom resolver replaces the runtime's default, so its encoding must match:
// GET/HEAD carry no body, POST defaults to URL encoding, and the matching
// Content-Type is set explicitly (multipart stays a FormData body so the browser
// adds the boundary).
// ---------------------------------------------------------------------------

describe('resolveFrameResponse request encoding', () => {
  it('defaults POST form data to URL encoding and sets the Content-Type', async () => {
    stubFetch({ redirected: false, ok: true, url: 'https://remix.run/admin/client', status: 200 })

    let formData = new FormData()
    formData.append('name', 'a b')
    await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      method: 'POST',
      formData,
      target: 'admin-content',
    })

    assert.equal(
      new Headers(lastFetchInit?.headers).get('Content-Type'),
      'application/x-www-form-urlencoded',
    )
    let body = lastFetchInit?.body
    assert.ok(body instanceof URLSearchParams, 'body should be URL-encoded')
    assert.equal(body.get('name'), 'a b')
  })

  it('sends no body for a GET reload carrying form data', async () => {
    stubFetch({ redirected: false, ok: true, url: 'https://remix.run/admin/client', status: 200 })

    let formData = new FormData()
    formData.append('name', 'a b')
    await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      method: 'GET',
      formData,
      target: 'admin-content',
    })

    assert.equal(lastFetchInit?.body, undefined)
    assert.equal(new Headers(lastFetchInit?.headers).get('Content-Type'), null)
  })

  it('forwards multipart form data untouched with no explicit Content-Type', async () => {
    stubFetch({ redirected: false, ok: true, url: 'https://remix.run/admin/client', status: 200 })

    let formData = new FormData()
    formData.append('file', 'contents')
    await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      method: 'POST',
      formData,
      encType: 'multipart/form-data',
      target: 'admin-content',
    })

    assert.equal(lastFetchInit?.body, formData)
    assert.equal(new Headers(lastFetchInit?.headers).get('Content-Type'), null)
  })

  it('encodes text/plain bodies and sets the matching Content-Type', async () => {
    stubFetch({ redirected: false, ok: true, url: 'https://remix.run/admin/client', status: 200 })

    let formData = new FormData()
    formData.append('name', 'a b')
    await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      method: 'POST',
      formData,
      encType: 'text/plain',
      target: 'admin-content',
    })

    assert.equal(new Headers(lastFetchInit?.headers).get('Content-Type'), 'text/plain')
    let body = lastFetchInit?.body
    assert.ok(body instanceof Blob, 'body should be a text blob')
    assert.equal(body.type, 'text/plain')
  })
})
