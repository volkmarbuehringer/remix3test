import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { getSafeReturnTo } from './redirect.ts'

// ---------------------------------------------------------------------------
// getSafeReturnTo pure function tests
// ---------------------------------------------------------------------------

describe('getSafeReturnTo', () => {
  // -----------------------------------------------------------------------
  // Happy path — valid returnTo paths
  // -----------------------------------------------------------------------

  it('returns a simple absolute path', () => {
    // Act
    let result = getSafeReturnTo('/dashboard')

    // Assert
    assert.equal(result, '/dashboard')
  })

  it('returns a nested absolute path', () => {
    // Act
    let result = getSafeReturnTo('/lists/42')

    // Assert
    assert.equal(result, '/lists/42')
  })

  it('returns a path with query parameters', () => {
    // Act
    let result = getSafeReturnTo('/search?q=test')

    // Assert
    assert.equal(result, '/search?q=test')
  })

  // -----------------------------------------------------------------------
  // Null / undefined / empty — should return undefined
  // -----------------------------------------------------------------------

  it('returns undefined for null input', () => {
    // Act
    let result = getSafeReturnTo(null)

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for empty string input', () => {
    // Act
    let result = getSafeReturnTo('')

    // Assert
    assert.equal(result, undefined)
  })

  // -----------------------------------------------------------------------
  // Open redirect prevention — unsafe URLs
  // -----------------------------------------------------------------------

  it('returns undefined for a full http:// URL', () => {
    // Act
    let result = getSafeReturnTo('http://evil.com')

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for a full https:// URL', () => {
    // Act
    let result = getSafeReturnTo('https://phishing.com/steal')

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for a protocol-relative URL (starting with //)', () => {
    // Act
    let result = getSafeReturnTo('//evil.com/steal')

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for a path with protocol scheme', () => {
    // Act
    let result = getSafeReturnTo('javascript:alert(1)')

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for a path starting with a backslash', () => {
    // Act
    let result = getSafeReturnTo('\\evil.com')

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for a relative path without leading slash', () => {
    // Act
    let result = getSafeReturnTo('dashboard')

    // Assert
    assert.equal(result, undefined)
  })
})
