import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { validatePasswordComplexity, PASSWORD_MIN_LENGTH } from './password-complexity.ts'

describe('validatePasswordComplexity', () => {
  it('returns null for a valid password meeting all rules', () => {
    assert.equal(validatePasswordComplexity('abc123!defg'), null)
    assert.equal(validatePasswordComplexity('Password1!abc'), null)
    assert.equal(validatePasswordComplexity('1!abcdefghij'), null)
  })

  it('returns error for password shorter than minimum length', () => {
    let err = validatePasswordComplexity('ab1!def')
    assert.ok(err?.includes(`${PASSWORD_MIN_LENGTH}`))
  })

  it('returns error for password missing a digit', () => {
    let err = validatePasswordComplexity('abcdefghij!')
    assert.ok(err?.includes('number'))
  })

  it('returns error for password missing a special character', () => {
    let err = validatePasswordComplexity('abcdefghij1')
    assert.ok(err?.includes('special character'))
  })

  it('returns first failing rule only', () => {
    let err = validatePasswordComplexity('short')
    assert.ok(err?.includes(`${PASSWORD_MIN_LENGTH}`))
  })

  it('accepts passwords with various special characters', () => {
    assert.equal(validatePasswordComplexity('abc123@defg'), null)
    assert.equal(validatePasswordComplexity('abc123#defg'), null)
    assert.equal(validatePasswordComplexity('abc123$defg'), null)
    assert.equal(validatePasswordComplexity('abc123%defg'), null)
    assert.equal(validatePasswordComplexity('abc123^defg'), null)
    assert.equal(validatePasswordComplexity('abc123&defg'), null)
    assert.equal(validatePasswordComplexity('abc123*defg'), null)
    assert.equal(validatePasswordComplexity('abc123(defg'), null)
    assert.equal(validatePasswordComplexity('abc123)defg'), null)
  })
})
