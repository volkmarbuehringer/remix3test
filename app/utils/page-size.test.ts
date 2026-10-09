import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  clearPageSize,
  getPageSize,
  getPageSizeOverride,
  isPageSizeKey,
  isValidPageSize,
  setPageSize,
  PAGE_SIZE_KEYS,
  PAGE_SIZE_MAX,
  PAGE_SIZE_MIN,
} from './get-page-size.ts'

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

/** Minimal in-memory session backing the reader/writer helpers. */
function memorySession(initial: Record<string, unknown> = {}) {
  let data: Record<string, unknown> = { ...initial }
  return {
    get: (key: string) => data[key],
    set: (key: string, value: unknown) => {
      data[key] = value
    },
    read: () => data,
  }
}

describe('per-page page-size overrides', () => {
  it('prefers the per-page override over the global default', () => {
    let session = memorySession({ pageSize: 20, pageSizes: { notifications: 50 } })
    assert.equal(getPageSize(session, 15, PAGE_SIZE_KEYS.notifications), 50)
  })

  it('falls back to the global default when the page has no override', () => {
    let session = memorySession({ pageSize: 20 })
    assert.equal(getPageSize(session, 15, PAGE_SIZE_KEYS.notifications), 20)
    assert.equal(getPageSizeOverride(session, PAGE_SIZE_KEYS.notifications), null)
  })

  it('ignores an invalid per-page override', () => {
    let session = memorySession({ pageSize: 20, pageSizes: { notifications: 999 } })
    assert.equal(getPageSize(session, 15, PAGE_SIZE_KEYS.notifications), 20)
    assert.equal(getPageSizeOverride(session, PAGE_SIZE_KEYS.notifications), null)
  })

  it('sets and clears the override without touching the global default', () => {
    let session = memorySession({ pageSize: 20 })

    assert.equal(setPageSize(session, 30, PAGE_SIZE_KEYS.notifications), true)
    assert.equal(getPageSize(session, 15, PAGE_SIZE_KEYS.notifications), 30)
    assert.equal(session.read().pageSize, 20, 'global default must stay untouched')
    assert.deepEqual(session.read().pageSizes, { notifications: 30 })

    clearPageSize(session, PAGE_SIZE_KEYS.notifications)
    assert.equal(getPageSize(session, 15, PAGE_SIZE_KEYS.notifications), 20)
    assert.equal(getPageSizeOverride(session, PAGE_SIZE_KEYS.notifications), null)
  })

  it('rejects an invalid page size when setting', () => {
    let session = memorySession()
    assert.equal(setPageSize(session, 0, PAGE_SIZE_KEYS.notifications), false)
    assert.equal(session.read().pageSizes, undefined, 'nothing should be written')
  })

  it('recognizes only registered page keys', () => {
    assert.ok(isPageSizeKey('verwaltung.offerings'))
    assert.ok(isPageSizeKey('notifications'))
    assert.ok(!isPageSizeKey('verwaltung.unknown'))
    assert.ok(!isPageSizeKey(''))
  })
})
