import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { agentPrefillMap } from '../ui/agent-prefill-store.browser.ts'
import {
  classifyFrameResponse,
  isSameOriginFrameSource,
  resolveFrameResponse,
} from './frame-response.browser.tsx'

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
//
// The request is built by the runtime's `defaultResolveFrame` since the #12249
// migration; the response policy (4xx renders, 5xx recovery card, 401 login,
// non-HTML error card) stays app-owned in `classifyFrameResponse`.
// ---------------------------------------------------------------------------

let originalFetch: typeof window.fetch | undefined
let lastFetchInit: RequestInit | undefined
let lastFetchUrl: string | undefined

function stubFetch(response: Partial<Response>) {
  originalFetch = window.fetch
  lastFetchInit = undefined
  lastFetchUrl = undefined
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    lastFetchUrl = String(input)
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
  lastFetchUrl = undefined
  agentPrefillMap.clear()
})

/**
 * A Response-shaped stub. `defaultResolveFrame` reads `status`, `statusText`, and
 * `headers` before the app policy runs, so a production-shaped header bag is required.
 */
function frameResponse(
  init: {
    status?: number
    contentType?: string | null
    redirected?: boolean
    url?: string
    text?: string
  } = {},
): Response {
  let status = init.status ?? 200
  let headers = new Headers()
  if (init.contentType !== null) {
    headers.set('Content-Type', init.contentType ?? 'text/html; charset=utf-8')
  }
  return {
    ok: status >= 200 && status < 300,
    redirected: init.redirected ?? false,
    url: init.url ?? 'https://remix.run/admin/client',
    status,
    statusText: '',
    headers,
    text: async () => init.text ?? '<div>Grid content</div>',
  } as Response
}

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
  // Negative observation: the contract is that the promise never settles, so
  // there is no completion event to await. A short window is the only proof.
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.ok(!settled, 'expected the promise to never settle (no document UI injected)')
}

describe('resolveFrameResponse redirect handling', () => {
  it('never settles when a frame reload response redirects with a target', async () => {
    stubFetch(frameResponse({ redirected: true, url: 'https://remix.run/login' }))

    let result = resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    await assertNeverSettles(result)
  })

  it('does not return the redirected document for the subframe', async () => {
    stubFetch(
      frameResponse({
        redirected: true,
        url: 'https://remix.run/login',
        text: '<html><body>Login page</body></html>',
      }),
    )

    let result = resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    await assertNeverSettles(result)
  })

  it('returns the response for a redirect without a frame target', async () => {
    let response = frameResponse({ redirected: true, url: 'https://remix.run/elsewhere' })
    stubFetch(response)

    let result = await resolveFrameResponse(new URL('/admin/client', window.location.origin))

    assert.equal(result, response, 'should return the response unchanged (subframe flow)')
  })

  it('returns a normal 200 response inside the subframe', async () => {
    let response = frameResponse()
    stubFetch(response)

    let result = await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    assert.equal(result, response, 'should return the 200 response for subframe rendering')
  })

  it('returns a 2xx HTML response inside the subframe', async () => {
    let response = frameResponse()
    stubFetch(response)

    let result = await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    assert.equal(result, response, 'should return the 2xx HTML response for subframe rendering')
  })

  it('shows the reload card for a non-HTML 2xx body and reports it', async (t) => {
    let errorSpy = t.mock.method(console, 'error')
    let response = frameResponse({ contentType: 'application/pdf' })
    stubFetch(response)

    let result = await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    assert.ok(result !== response, 'should not mount a declared non-HTML 2xx body as a frame')
    assert.equal(errorSpy.mock.calls.length, 1, 'the misconfigured frame should be reported')
  })

  it('renders a 4xx response body so validation errors show in the frame', async () => {
    let response = frameResponse({
      status: 400,
      text: '<div>slot outside booking hours</div>',
    })
    stubFetch(response)

    let result = await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    // 4xx is an intended validation/not-found fragment — return it so the frame
    // renders the inline error instead of the generic crash card.
    assert.equal(result, response, 'should return the 4xx response for subframe rendering')
  })

  it('shows the reload card for a non-HTML 4xx body and reports it', async (t) => {
    let errorSpy = t.mock.method(console, 'error')
    let response = frameResponse({
      status: 404,
      contentType: 'application/json',
      text: '{"error":"not found"}',
    })
    stubFetch(response)

    let result = await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    // A JSON/plain-text body is not a frame fragment; reconciling it as HTML is
    // wrong, so the resolver surfaces the bounded recovery card instead.
    assert.ok(result !== response, 'should not return a non-HTML 4xx body for rendering')
    assert.equal(errorSpy.mock.calls.length, 1, 'the misconfigured frame should be reported')
  })

  it('shows the reload card for a 5xx server error', async () => {
    // `defaultResolveFrame` throws on every 5xx before the app policy runs; the
    // captured response is reclassified onto the recovery card.
    let response = frameResponse({ status: 500, text: '<div>boom</div>' })
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
// resolveFrameResponse — delegated request construction (remix #12249/#11938)
//
// The runtime's `defaultResolveFrame` owns method, form encoding, Accept, frame
// headers, and `same-origin`; the app's `fetch` override adds only the one-shot
// prefill and `no-store`.
// ---------------------------------------------------------------------------

describe('resolveFrameResponse request construction', () => {
  it('sends the runtime frame headers and same-origin mode', async () => {
    stubFetch(frameResponse())

    await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    let headers = new Headers(lastFetchInit?.headers)
    assert.equal(headers.get('Accept'), 'text/html')
    assert.equal(headers.get('X-Remix-Frame'), 'true')
    assert.equal(headers.get('X-Remix-Target'), 'admin-content')
    assert.equal(lastFetchInit?.mode, 'same-origin')
    assert.equal(lastFetchUrl, `${window.location.origin}/admin/client`)
  })

  it('omits X-Remix-Target for an unnamed frame and strips the source hash', async () => {
    stubFetch(frameResponse())

    await resolveFrameResponse(new URL('/admin/client#section', window.location.origin))

    let headers = new Headers(lastFetchInit?.headers)
    assert.equal(headers.get('X-Remix-Target'), null)
    assert.equal(lastFetchUrl, `${window.location.origin}/admin/client`)
  })

  it('rides the one-shot agent prefill on the request', async () => {
    agentPrefillMap.set('/admin/client', { message: 'hi' })
    stubFetch(frameResponse())

    await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    let raw = new Headers(lastFetchInit?.headers).get('X-Agent-Prefill')
    assert.ok(raw, 'expected the prefill header')
    assert.deepEqual(JSON.parse(atob(raw)), { message: 'hi' })
  })

  it('sets no-store on every frame request', async () => {
    stubFetch(frameResponse())

    await resolveFrameResponse(new URL('/admin/client', window.location.origin), {
      target: 'admin-content',
    })

    assert.equal(lastFetchInit?.cache, 'no-store')
  })

  it('defaults POST form data to URL encoding and sets the Content-Type', async () => {
    stubFetch(frameResponse())

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
    stubFetch(frameResponse())

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
    stubFetch(frameResponse())

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
    stubFetch(frameResponse())

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

// ---------------------------------------------------------------------------
// classifyFrameResponse — the full 4xx/5xx/401 policy
//
// The classifier is pure, so 401/login and cross-section redirect outcomes are
// asserted without calling `window.location.assign` (unforgeable in a browser).
// ---------------------------------------------------------------------------

function outcome(
  response: Response,
  options?: { target?: string; mode?: 'navigate' | 'prefetch' },
) {
  return classifyFrameResponse(response, options).kind
}

describe('classifyFrameResponse', () => {
  it('renders HTML 4xx validation and not-found fragments', () => {
    assert.equal(outcome(frameResponse({ status: 400 })), 'render')
    assert.equal(outcome(frameResponse({ status: 404 })), 'render')
  })

  it('renders 2xx responses with HTML or a missing content type', () => {
    assert.equal(outcome(frameResponse()), 'render')
    assert.equal(outcome(frameResponse({ contentType: null })), 'render')
  })

  it('maps a 5xx response to the recovery card even when it declares HTML', () => {
    assert.equal(outcome(frameResponse({ status: 500 })), 'recovery-card')
    assert.equal(outcome(frameResponse({ status: 503 })), 'recovery-card')
  })

  it('maps non-HTML 2xx and 4xx bodies to a reported error card', () => {
    assert.equal(outcome(frameResponse({ contentType: 'application/json' })), 'non-html-error')
    assert.equal(
      outcome(frameResponse({ status: 404, contentType: 'text/plain' })),
      'non-html-error',
    )
  })

  it('sends 401 responses to the login page with either body type', () => {
    assert.equal(outcome(frameResponse({ status: 401 })), 'login')
    assert.equal(outcome(frameResponse({ status: 401, contentType: 'application/json' })), 'login')
  })

  it('leaves the document for a followed redirect that carries a frame target', () => {
    let response = frameResponse({ redirected: true, url: 'https://remix.run/auth/login' })
    assert.deepEqual(classifyFrameResponse(response, { target: 'admin-content' }), {
      kind: 'document-navigation',
      url: 'https://remix.run/auth/login',
    })
    assert.equal(
      outcome(response),
      'render',
      'a top-frame redirect keeps the subframe flow and renders the destination document',
    )
  })

  it('never navigates or caches while prefetching', () => {
    assert.equal(outcome(frameResponse({ status: 500 }), { mode: 'prefetch' }), 'navigated')
    assert.equal(outcome(frameResponse({ status: 401 }), { mode: 'prefetch' }), 'navigated')
    assert.equal(
      outcome(frameResponse({ redirected: true, url: 'https://remix.run/login' }), {
        target: 'admin-content',
        mode: 'prefetch',
      }),
      'navigated',
    )
    assert.equal(
      outcome(frameResponse({ contentType: 'application/json' }), { mode: 'prefetch' }),
      'navigated',
    )
    assert.equal(outcome(frameResponse({ status: 400 }), { mode: 'prefetch' }), 'render')
  })
})
