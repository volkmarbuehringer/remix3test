import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../test-router.ts'
import { CsrfTokenInput, tryGetCsrfToken } from './csrf-token-input.tsx'
import { routes } from '../routes.ts'

const BASE = 'https://remix.run'

// ---------------------------------------------------------------------------
// CsrfTokenInput — unit tests (outside async context)
// ---------------------------------------------------------------------------

describe('CsrfTokenInput', () => {
  it('returns null when getContext() is not available', () => {
    // Arrange: call CsrfTokenInput factory outside of a request context
    let render = CsrfTokenInput()

    // Act: invoke the render function without async context
    let result = render()

    // Assert: returns null gracefully
    assert.equal(result, null)
  })
})

// ---------------------------------------------------------------------------
// tryGetCsrfToken — unit tests (outside async context)
// ---------------------------------------------------------------------------

describe('tryGetCsrfToken', () => {
  it('returns undefined when getContext() is not available', () => {
    // Arrange & Act: call tryGetCsrfToken outside of a request context
    let result = tryGetCsrfToken()

    // Assert: returns undefined gracefully
    assert.equal(result, undefined)
  })
})

// ---------------------------------------------------------------------------
// Integration tests — CSRF token rendering through the router
// ---------------------------------------------------------------------------

describe('CsrfTokenInput — integration', () => {
  it('renders a hidden input with name="_csrf" in the login form', async () => {
    // Arrange & Act: fetch the login page which includes CsrfTokenInput
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)

    // Assert
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('<input type="hidden" name="_csrf"'),
      'should render a hidden CSRF token input',
    )
  })

  it('renders a 64-character hex CSRF token value', async () => {
    // Arrange & Act
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let html = await response.text()

    // Assert: extract the token value and verify format
    let match = html.match(/<input[^>]*name="_csrf"[^>]*value="([^"]+)"/)
    assert.ok(match, 'should have a CSRF token value')
    let token = match![1]
    assert.equal(token.length, 64, 'CSRF token value should be 64 characters')
    assert.ok(/^[0-9a-f]{64}$/.test(token), 'CSRF token value should be a hex string')
  })
})
