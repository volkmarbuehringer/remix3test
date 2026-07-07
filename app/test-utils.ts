import { createSession } from 'remix/session'
import { SetCookie } from 'remix/headers'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { pool } from './data/setup.ts'
// Direct pool.query is intentional here — test seeding/lookup needs raw SQL
// access that doesn't route through repository modules (which would create
// circular dependencies with the test router).
import { router } from './test-router.ts'

/**
 * Generate a CSRF token matching the format used by remix/csrf-middleware.
 * 64-char hex string from 32 random bytes.
 */
export function generateCsrfToken(): string {
  let bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let token = ''
  for (let byte of bytes) {
    token += byte.toString(16).padStart(2, '0')
  }
  return token
}

/**
 * Perform a GET request to the given URL and extract the session cookie
 * and CSRF token from the response. Useful for tests that need to make
 * subsequent POST requests with CSRF protection.
 *
 * @returns The session cookie string (e.g. `session=xxx`) and the CSRF token value.
 */
export async function createCsrfSession(url: string): Promise<{ cookie: string; csrfToken: string }> {
  let response = await router.fetch(url)
  let cookie = extractCookie(response)
  let html = await response.text()
  // Extract CSRF token from <input type="hidden" name="_csrf" value="...">
  let match = html.match(/<input[^>]*name="_csrf"[^>]*value="([^"]+)"/)
  if (!match) {
    throw new Error('Could not extract CSRF token from response. Ensure csrf() middleware is active and the page renders a form with _csrf input.')
  }
  return { cookie, csrfToken: match[1] }
}

/**
 * Create an authenticated session cookie that also includes a CSRF token.
 * This allows tests to make authenticated POST requests without needing
 * to perform a separate GET + token extraction step.
 *
 * @returns The session cookie string and the CSRF token value.
 */
export async function createAuthCookieWithCsrf(): Promise<{ cookie: string; csrfToken: string } | null> {
  try {
    let result = await pool.query('SELECT id, token_version FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'])
    if (result.rows.length === 0) return null

    let userId = result.rows[0].id as number
    let tv = (result.rows[0] as { token_version: number }).token_version ?? 1
    let csrfToken = generateCsrfToken()

    let session = createSession<{ auth: { userId: number; tv: number }; _csrf: string }>()
    session.set('auth', { userId, tv })
    session.set('_csrf', csrfToken)

    let sid = await sessionStorage.save(session)
    if (!sid) return null

    let setCookieValue = await sessionCookie.serialize(sid)
    let match = setCookieValue.match(/session=([^;]+)/)
    if (!match) return null

    return { cookie: `session=${match[1]}`, csrfToken }
  } catch {
    return null
  }
}

export async function createAuthCookieWithCsrfForUser(email: string): Promise<{ cookie: string; csrfToken: string } | null> {
  try {
    let result = await pool.query('SELECT id, role, token_version FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) return null

    let user = result.rows[0] as { id: number; role: string; token_version: number }
    let csrfToken = generateCsrfToken()

    let session = createSession<{ auth: { userId: number; tv: number }; _csrf: string }>()
    session.set('auth', { userId: user.id, tv: user.token_version ?? 1 })
    session.set('_csrf', csrfToken)

    let sid = await sessionStorage.save(session)
    if (!sid) return null

    let setCookieValue = await sessionCookie.serialize(sid)
    let match = setCookieValue.match(/session=([^;]+)/)
    if (!match) return null

    return { cookie: `session=${match[1]}`, csrfToken }
  } catch {
    return null
  }
}

/**
 * Create an authenticated session cookie with an additional `pendingBooking`
 * session value pre-set. Allows tests to directly exercise the
 * confirm_booking endpoint without first calling the agent.
 *
 * @returns The session cookie string and the CSRF token value.
 */
export async function createAuthCookieWithPendingBooking(
  pendingBooking: string,
): Promise<{ cookie: string; csrfToken: string } | null> {
  try {
    let result = await pool.query('SELECT id, token_version FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'])
    if (result.rows.length === 0) return null

    let userId = result.rows[0].id as number
    let tv = (result.rows[0] as { token_version: number }).token_version ?? 1
    let csrfToken = generateCsrfToken()

    let session = createSession()
    session.set('auth', { userId, tv })
    session.set('_csrf', csrfToken)
    session.set('pendingBooking', pendingBooking)

    let sid = await sessionStorage.save(session)
    if (!sid) return null

    let setCookieValue = await sessionCookie.serialize(sid)
    let match = setCookieValue.match(/session=([^;]+)/)
    if (!match) return null

    return { cookie: `session=${match[1]}`, csrfToken }
  } catch {
    return null
  }
}

/**
 * Create a test user for testing.
 * Returns the user ID or null if creation fails.
 */
export async function createTestUser(email?: string): Promise<number | null> {
  try {
    let testEmail = email ?? `test-${Date.now()}@example.com`
    let result = await pool.query(
      'INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at) VALUES ($1, $2, $3, $4, 1, 1, $5) RETURNING id',
      [testEmail, 'hashed-password-for-testing', 'Test User', 'customer', Date.now()],
    )
    return (result.rows[0]?.id as number) ?? null
  } catch {
    return null
  }
}

/**
 * Extract the session cookie name=value from a Set-Cookie header.
 */
export function extractCookie(response: Response): string {
  let parsed = SetCookie.from(response.headers.get('Set-Cookie'))
  if (!parsed.name) return ''
  return `${parsed.name}=${parsed.value ?? ''}`
}
