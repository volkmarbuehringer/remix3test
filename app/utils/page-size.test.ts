import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { getPageSize, isValidPageSize, PAGE_SIZE_MAX, PAGE_SIZE_MIN } from './get-page-size.ts'

describe('isValidPageSize', () => {
  it('accepts any whole number in range', () => {
    assert.ok(isValidPageSize(PAGE_SIZE_MIN))
    assert.ok(isValidPageSize(PAGE_SIZE_MAX))
    assert.ok(isValidPageSize(17))
  })

  it('rejects out-of-range and non-integer values', () => {
    assert.ok(!isValidPageSize(PAGE_SIZE_MIN - 1))
    assert.ok(!isValidPageSize(PAGE_SIZE_MAX + 1))
    assert.ok(!isValidPageSize(17.5))
    assert.ok(!isValidPageSize(Number.NaN))
  })
})

describe('getPageSize', () => {
  it('returns the default without a session', () => {
    assert.equal(getPageSize(null, 15), 15)
    assert.equal(getPageSize(undefined, 12), 12)
  })

  it('uses an explicit arbitrary override', () => {
    assert.equal(getPageSize({ get: () => 17 }, 15), 17)
  })

  it('ignores an invalid override', () => {
    assert.equal(getPageSize({ get: () => 200 }, 15), 15)
    assert.equal(getPageSize({ get: () => '25' }, 15), 15)
    assert.equal(getPageSize({ get: () => 0 }, 15), 15)
  })
})
