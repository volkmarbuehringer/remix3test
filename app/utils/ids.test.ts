import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { parseId } from './ids.ts'

// ---------------------------------------------------------------------------
// parseId pure function tests
// ---------------------------------------------------------------------------

describe('parseId', () => {
  // -----------------------------------------------------------------------
  // Happy path — valid inputs
  // -----------------------------------------------------------------------

  it('returns the same number for a valid number input', () => {
    // Act
    let result = parseId(42)

    // Assert
    assert.equal(result, 42)
  })

  it('returns a parsed number for a valid numeric string', () => {
    // Act
    let result = parseId('42')

    // Assert
    assert.equal(result, 42)
  })

  it('returns 0 for the string "0"', () => {
    // Act
    let result = parseId('0')

    // Assert
    assert.equal(result, 0)
  })

  it('returns 0 for the number 0', () => {
    // Act
    let result = parseId(0)

    // Assert
    assert.equal(result, 0)
  })

  it('returns the number for a string with leading/trailing whitespace', () => {
    // Act
    let result = parseId('  42  ')

    // Assert
    assert.equal(result, 42)
  })

  // -----------------------------------------------------------------------
  // Invalid inputs — should return undefined
  // -----------------------------------------------------------------------

  it('returns undefined for a non-numeric string', () => {
    // Act
    let result = parseId('abc')

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for a mixed string', () => {
    // Act
    let result = parseId('12abc')

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for null', () => {
    // Act
    let result = parseId(null)

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for undefined', () => {
    // Act
    let result = parseId(undefined)

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for an object', () => {
    // Act
    let result = parseId({})

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for an array', () => {
    // Act
    let result = parseId([1, 2, 3])

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for a boolean', () => {
    // Act
    let result = parseId(true)

    // Assert
    assert.equal(result, undefined)
  })

  // -----------------------------------------------------------------------
  // Safe-integer boundaries
  // -----------------------------------------------------------------------

  it('returns the number for Number.MAX_SAFE_INTEGER as a string', () => {
    // Act
    let result = parseId(String(Number.MAX_SAFE_INTEGER))

    // Assert
    assert.equal(result, Number.MAX_SAFE_INTEGER)
  })

  it('returns undefined for a string exceeding MAX_SAFE_INTEGER', () => {
    // Act
    let result = parseId('999999999999999999999')

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for a number exceeding MAX_SAFE_INTEGER', () => {
    // Act
    let result = parseId(999999999999999999999)

    // Assert
    assert.equal(result, undefined)
  })

  it('returns -1 for negative safe integer as string', () => {
    // Act
    let result = parseId('-1')

    // Assert
    assert.equal(result, -1)
  })

  it('returns undefined for a NaN value', () => {
    // Act
    let result = parseId(NaN)

    // Assert
    assert.equal(result, undefined)
  })

  it('returns undefined for Infinity', () => {
    // Act
    let result = parseId(Infinity)

    // Assert
    assert.equal(result, undefined)
  })
})
