import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  generateCsrfToken,
  extractCookie,
  createCsrfSession,
} from './test-utils.ts'
import { routes } from './routes.ts'

const BASE = 'https://remix.run'

// ---------------------------------------------------------------------------
// generateCsrfToken
// ---------------------------------------------------------------------------

describe('generateCsrfToken', () => {
  it('returns a 64-character hex string', () => {
    // Arrange & Act
    let token = generateCsrfToken()

    // Assert
    assert.equal(token.length, 64, 'should be 64 characters')
    assert.ok(
      /^[0-9a-f]{64}$/.test(token),
      'should be a lowercase hex string',
    )
  })

  it('generates unique tokens on each call', () => {
    // Arrange & Act
    let token1 = generateCsrfToken()
    let token2 = generateCsrfToken()

    // Assert
    assert.notEqual(
      token1,
      token2,
      'should generate different tokens each time',
    )
  })
})

// ---------------------------------------------------------------------------
// extractCookie
// ---------------------------------------------------------------------------

describe('extractCookie', () => {
  it('extracts the session cookie name=value from a Set-Cookie header', () => {
    // Arrange
    let response = new Response(null, {
      headers: {
        'Set-Cookie':
          'session=abc123; Path=/; HttpOnly; SameSite=Lax; Secure',
      },
    })

    // Act
    let cookie = extractCookie(response)

    // Assert
    assert.equal(cookie, 'session=abc123', 'should extract session=abc123')
  })

  it('returns empty string when no Set-Cookie header is present', () => {
    // Arrange
    let response = new Response(null)

    // Act
    let cookie = extractCookie(response)

    // Assert
    assert.equal(cookie, '', 'should return empty string')
  })

  it('returns empty string when Set-Cookie header is empty', () => {
    // Arrange
    let response = new Response(null, {
      headers: { 'Set-Cookie': '' },
    })

    // Act
    let cookie = extractCookie(response)

    // Assert
    assert.equal(cookie, '', 'should return empty string')
  })

  it('handles multiple Set-Cookie headers by extracting the first', () => {
    // Arrange
    let response = new Response(null, {
      headers: [
        ['Set-Cookie', 'session=first; Path=/'],
        ['Set-Cookie', 'other=value; Path=/'],
      ],
    })

    // Act
    let cookie = extractCookie(response)

    // Assert
    assert.equal(cookie, 'session=first', 'should extract the first cookie')
  })

  it('handles cookies without attributes after the value', () => {
    // Arrange
    let response = new Response(null, {
      headers: { 'Set-Cookie': 'session=xyz' },
    })

    // Act
    let cookie = extractCookie(response)

    // Assert
    assert.equal(cookie, 'session=xyz', 'should extract the bare cookie')
  })
})

// ---------------------------------------------------------------------------
// createCsrfSession
// ---------------------------------------------------------------------------

describe('createCsrfSession', () => {
  it('makes a GET request and returns a cookie + CSRF token', async () => {
    // Arrange & Act: createCsrfSession fetches /login and extracts cookie + token
    let result = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    // Assert
    assert.ok(result, 'should return a result object')
    assert.ok(result.cookie.startsWith('session='), 'should have a session cookie')
    assert.equal(
      result.csrfToken.length,
      64,
      'CSRF token should be 64 characters',
    )
    assert.ok(
      /^[0-9a-f]{64}$/.test(result.csrfToken),
      'CSRF token should be a hex string',
    )
  })

  it('throws an error when the page has no CSRF form input', async () => {
    // Arrange & Act & Assert: a URL without a form should cause createCsrfSession to throw
    try {
      // Use an API endpoint that doesn't have a CSRF form
      await createCsrfSession(`${BASE}${routes.auth.logout.href()}`)
      assert.fail('Expected an error for page without CSRF token input')
    } catch (error) {
      assert.ok(error instanceof Error, 'should throw an Error')
      assert.ok(
        (error as Error).message.includes('Could not extract CSRF token'),
        'should mention missing CSRF token',
      )
    }
  })
})
