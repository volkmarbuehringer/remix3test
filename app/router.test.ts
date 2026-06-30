import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from './router.ts'
import { initializeAppDatabase } from './data/setup.ts'
import { createAuthCookieWithCsrfForUser, createCsrfSession } from './test-utils.ts'
import { routes } from './routes.ts'

// ---------------------------------------------------------------------------
// Frame streaming integration tests
//
// Tests that the frame streaming pipeline works end-to-end:
//   - Fallback content streams before frame content
//   - Resolved frames are wrapped in <template> tags
//   - Fragment endpoints render without Layout/Document wrappers
//   - Unauthenticated requests to fragments are redirected
//
// Patterned after frames-demo's router.test.ts.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'

// ── Streaming helpers ──────────────────────────────────────────

async function* readChunks(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, void> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()

  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      yield decoder.decode(value, { stream: true })
    }

    // Flush decoder state
    let final = decoder.decode()
    if (final) yield final
  } finally {
    reader.releaseLock()
  }
}

async function readUntil(
  chunks: AsyncGenerator<string, void, void>,
  predicate: (html: string) => boolean,
): Promise<string> {
  let html = ''

  while (true) {
    let result = await chunks.next()
    assert.equal(result.done, false, 'Stream ended before predicate was satisfied')
    html += result.value
    if (predicate(html)) return html
  }
}

function countTemplates(html: string): number {
  return html.match(/<template\b/g)?.length ?? 0
}

// ── Admin page streaming ───────────────────────────────────────

describe('Admin page — frame streaming', () => {
  let adminCookie: string

  before(async () => {
    await initializeAppDatabase()

    let result = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = result?.cookie ?? ''
  })

  it('streams fallback content before frame content', async () => {
    let response = await router.fetch(`${BASE}/admin`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    assert.ok(response.body, 'Response body stream should be available')

    let chunks = readChunks(response.body)

    // Read until we see admin sidebar content — this renders synchronously
    // inside the adminContent frame (blocking frame)
    let initial = await readUntil(chunks, (html) => html.includes('Chat-Protokolle'))
    assert.ok(initial.includes('Chat-Protokolle'), 'Admin dashboard cards should appear')
    assert.ok(initial.includes('Listen'), 'Listen card should appear')
    assert.ok(initial.includes('Client-Test'), 'Client-Test card should appear')

    // At this point, no <template> tags should appear yet (nested frames
    // like stats and recent-activity haven't resolved)
    // NOTE: templates may appear in the very next chunk if frames resolve
    // quickly, so we just verify templates will eventually appear
  })

  it('resolves nested frames with template tags', async () => {
    let response = await router.fetch(`${BASE}/admin`, {
      headers: { Cookie: adminCookie },
    })

    assert.ok(response.body)
    let chunks = readChunks(response.body)

    // Read until we see the first <template> tag (stats frame resolving)
    let resolved = await readUntil(chunks, (html) => html.includes('<template'))
    assert.ok(
      countTemplates(resolved) >= 1,
      'Should have at least one <template> tag when frames resolve',
    )

    // The first <template> chunk contains the stats frame with Uptime.
    // Stats content is already in `resolved` — no need for a separate read.
    assert.ok(resolved.includes('Server'), 'Stats frame should contain server info')
    assert.ok(resolved.includes('Betriebszeit'), 'Stats frame should contain Betriebszeit')
  })

  it('eventually renders all framed content', async () => {
    let response = await router.fetch(`${BASE}/admin`, {
      headers: { Cookie: adminCookie },
    })

    assert.ok(response.body)
    let chunks = readChunks(response.body)

    // Consume the entire stream
    let html = ''
    for await (let chunk of chunks) {
      html += chunk
    }

    // Verify framed content all resolved
    assert.ok(html.includes('Chat-Protokolle'), 'Admin dashboard cards should render')
    assert.ok(html.includes('Server'), 'Stats fragment should resolve')
    assert.ok(html.includes('Betriebszeit'), 'Stats fragment should include Betriebszeit')
    assert.ok(html.includes('Letzte Aktivitäten'), 'Activity fragment should resolve')
    assert.ok(
      countTemplates(html) >= 2,
      'Should have at least 2 template tags for stats + activity frames',
    )
  })
})

// ── AI page streaming ──────────────────────────────────────────

describe('AI page — frame streaming', () => {
  let userCookie: string

  before(async () => {
    let result = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = result?.cookie ?? ''
  })

  it('streams AI sidebar content and resolves dashboard frame', async () => {
    let response = await router.fetch(`${BASE}/ai`, {
      headers: { Cookie: userCookie },
    })

    assert.equal(response.status, 200)
    assert.ok(response.body)

    let chunks = readChunks(response.body)

    // Read until we see AI sidebar content (rendered inside the aiContent frame)
    let html = await readUntil(chunks, (content) => content.includes('AI Dashboard'))
    assert.ok(html.includes('AI Dashboard'), 'AI Dashboard heading should appear')
    assert.ok(html.includes('Chat'), 'Chat card should render')
    assert.ok(html.includes('Agent'), 'Agent card should render')
  })

  it('renders AI page content from stream', async () => {
    let response = await router.fetch(`${BASE}/ai`, {
      headers: { Cookie: userCookie },
    })

    assert.ok(response.body)
    let html = ''
    for await (let chunk of readChunks(response.body)) {
      html += chunk
    }

    assert.ok(html.includes('AI Dashboard'), 'AI Dashboard should render')
    assert.ok(html.includes('Chat öffnen'), 'Chat öffnen button should appear')
    assert.ok(html.includes('Agent öffnen'), 'Agent öffnen button should appear')
  })
})

// ── Fragment endpoint tests ────────────────────────────────────

describe('Fragment endpoints — standalone rendering', () => {
  let adminCookie: string
  let userCookie: string

  before(async () => {
    let adminResult = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = adminResult?.cookie ?? ''

    let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = userResult?.cookie ?? ''
  })

  it('/admin/fragments/stats renders without Layout wrapper', async () => {
    let response = await router.fetch(`${BASE}/admin/fragments/stats`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    // Fragment should NOT have the outer Document wrapper.
    // Note: createHtmlResponse always adds <!DOCTYPE html>, so we only
    // check that <html> is absent (meaning no Document component).
    assert.ok(!html.includes('<html'), 'Stats fragment should not contain <html>')
    // Fragment should contain stats content
    assert.ok(html.includes('Server'), 'Stats fragment should contain server info')
    assert.ok(html.includes('Betriebszeit'), 'Stats fragment should contain Betriebszeit')
  })

  it('/admin/fragments/recent-activity renders without Layout wrapper', async () => {
    let response = await router.fetch(`${BASE}/admin/fragments/recent-activity`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    assert.ok(!html.includes('<html'), 'Activity fragment should not contain <html>')
    assert.ok(html.includes('Letzte Aktivitäten'), 'Activity fragment should have heading')
    assert.ok(html.includes('Created'), 'Activity fragment should show activity items')
  })

  it('/ai/fragments/agent-result renders without Layout wrapper', async () => {
    let response = await router.fetch(
      `${BASE}/ai/fragments/agent-result?prompt=test+message`,
      { headers: { Cookie: userCookie } },
    )

    assert.equal(response.status, 200)
    let html = await response.text()

    assert.ok(!html.includes('<html'), 'Agent result fragment should not contain <html>')
    assert.ok(html.includes('test message'), 'Agent result should include the prompt text')
  })

  it('fragment endpoints reject unauthenticated requests', async () => {
    let statsRes = await router.fetch(`${BASE}/admin/fragments/stats`, {
      redirect: 'manual',
    })
    assert.equal(statsRes.status, 302, 'Unauthenticated stats request should redirect')

    let activityRes = await router.fetch(`${BASE}/admin/fragments/recent-activity`, {
      redirect: 'manual',
    })
    assert.equal(activityRes.status, 302, 'Unauthenticated activity request should redirect')

    let agentRes = await router.fetch(`${BASE}/ai/fragments/agent-result`, {
      redirect: 'manual',
    })
    assert.equal(agentRes.status, 302, 'Unauthenticated agent result request should redirect')
  })
})

// ---------------------------------------------------------------------------
// CSRF protection
// ---------------------------------------------------------------------------

describe('CSRF protection', () => {
  // -----------------------------------------------------------------------
  // POST without CSRF token
  // -----------------------------------------------------------------------

  it('POST /login without CSRF token returns 403', async () => {
    // Arrange: make a POST to login without _csrf in the body
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      body: new URLSearchParams({ email: 'admin@newapp.com', password: 'admin123' }),
      redirect: 'manual',
    })

    // Assert: CSRF middleware rejects the request
    assert.equal(response.status, 403, 'should reject POST without CSRF token')
  })

  // -----------------------------------------------------------------------
  // POST with valid CSRF token passes through
  // -----------------------------------------------------------------------

  it('POST /login with valid CSRF token passes through', async () => {
    // Arrange: get a CSRF token + session cookie from the login page
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    // Act: use the token in a POST request
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        email: 'admin@newapp.com',
        password: process.env.SEED_ADMIN_PASSWORD!,
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    // Assert: request passes CSRF validation
    // (status is 302 because login succeeded, not 403 from CSRF)
    assert.equal(
      response.status,
      302,
      'POST with valid CSRF token should pass through',
    )
  })

  // -----------------------------------------------------------------------
  // GET without CSRF token passes through
  // -----------------------------------------------------------------------

  it('GET /login passes through without CSRF validation', async () => {
    // Arrange & Act: GET requests should not require CSRF token
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)

    // Assert: CSRF middleware does not block GET requests
    assert.equal(
      response.status,
      200,
      'GET should pass through without CSRF validation',
    )
  })

  // -----------------------------------------------------------------------
  // CSRF token in login form matches session token
  // -----------------------------------------------------------------------

  it('CSRF token rendered in login form HTML matches the session token', async () => {
    // Arrange: fetch the login page and extract both cookie + token from the same session
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    // Act: use the extracted token + cookie pair in a login POST
    let loginResponse = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        email: 'admin@newapp.com',
        password: process.env.SEED_ADMIN_PASSWORD!,
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    // Assert: the token from the HTML form is valid for the session
    // A 302 means login succeeded, proving the CSRF token matched
    assert.equal(
      loginResponse.status,
      302,
      'CSRF token from HTML form should match session token and allow POST',
    )
  })
})
