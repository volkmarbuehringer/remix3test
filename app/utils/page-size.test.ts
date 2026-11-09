import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import * as s from 'remix/data-schema'

import {
  clearPageSize,
  getPageSize,
  getPageSizeOverride,
  isPageSizeKey,
  isValidPageSize,
  pageSizeFormSchema,
  pageSizeOptions,
  setPageSize,
  PAGE_SIZE_KEYS,
  PAGE_SIZE_MAX,
  PAGE_SIZE_MIN,
  PAGE_SIZE_MOBILE_DEFAULT,
  PAGE_SIZE_PRESETS,
} from './get-page-size.ts'
import { VIEWPORT_SESSION_KEY } from './viewport-class.ts'

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

describe('mobile page size', () => {
  it('uses the smaller default on a phone-sized viewport', () => {
    let session = memorySession({ [VIEWPORT_SESSION_KEY]: 'mobile' })
    assert.equal(getPageSize(session, 15), PAGE_SIZE_MOBILE_DEFAULT)
    assert.equal(getPageSize(session, 15, PAGE_SIZE_KEYS.notifications), PAGE_SIZE_MOBILE_DEFAULT)
  })

  it('keeps the route default on a desktop viewport', () => {
    let session = memorySession({ [VIEWPORT_SESSION_KEY]: 'desktop' })
    assert.equal(getPageSize(session, 15), 15)
    assert.equal(getPageSize(session, 20), 20)
  })

  it('never exceeds a route default that is already smaller', () => {
    let session = memorySession({ [VIEWPORT_SESSION_KEY]: 'mobile' })
    assert.equal(getPageSize(session, 3), 3, 'a route that wants fewer rows keeps its own default')
  })

  it('lets an explicit global default win over the mobile default', () => {
    let session = memorySession({ [VIEWPORT_SESSION_KEY]: 'mobile', pageSize: 40 })
    assert.equal(getPageSize(session, 15), 40)
  })

  it('lets an explicit per-page override win over the mobile default', () => {
    let session = memorySession({
      [VIEWPORT_SESSION_KEY]: 'mobile',
      pageSizes: { notifications: 30 },
    })
    assert.equal(getPageSize(session, 15, PAGE_SIZE_KEYS.notifications), 30)
  })

  it('treats an unknown viewport class as desktop', () => {
    let session = memorySession({ [VIEWPORT_SESSION_KEY]: 'tablet' })
    assert.equal(getPageSize(session, 15), 15)
  })
})

describe('pageSizeOptions', () => {
  it('offers every preset', () => {
    for (let preset of PAGE_SIZE_PRESETS) {
      assert.ok(pageSizeOptions(15).includes(preset), `preset ${preset} must be offered`)
    }
  })

  it('keeps a saved value that is not a preset', () => {
    // A size saved from the old range slider must stay selected instead of
    // silently jumping to a preset.
    assert.ok(pageSizeOptions(37).includes(37))
  })

  it('drops an invalid saved value', () => {
    assert.ok(!pageSizeOptions(999).includes(999))
    assert.ok(!pageSizeOptions(0).includes(0))
  })

  it('returns the options in ascending order', () => {
    let options = pageSizeOptions(37)
    assert.deepEqual(
      options,
      [...options].toSorted((a, b) => a - b),
    )
  })
})

describe('pageSizeFormSchema', () => {
  function submission(fields: Record<string, string>): FormData {
    let data = new FormData()
    for (let [key, value] of Object.entries(fields)) data.append(key, value)
    return data
  }

  it('decodes numeric-text page sizes and their grid key', () => {
    let parsed = s.parseSafe(
      pageSizeFormSchema,
      submission({ pageKey: 'notifications', pageSize: '50' }),
    )
    assert.ok(parsed.success)
    assert.equal(parsed.value.pageKey, 'notifications')
    assert.equal(parsed.value.pageSize, 50)
  })

  it('prefers the free-form custom size over the preset select', () => {
    let parsed = s.parseSafe(
      pageSizeFormSchema,
      submission({ pageKey: 'notifications', pageSize: '25', pageSizeCustom: '37' }),
    )
    assert.ok(parsed.success)
    assert.equal(parsed.value.pageSize, 37)
  })

  it('accepts a custom size without a preset value', () => {
    let parsed = s.parseSafe(pageSizeFormSchema, submission({ pageSizeCustom: '37' }))
    assert.ok(parsed.success)
    assert.equal(parsed.value.pageSize, 37)
  })

  it('falls back to the preset when the custom field is blank', () => {
    let parsed = s.parseSafe(
      pageSizeFormSchema,
      submission({ pageSize: '50', pageSizeCustom: '   ' }),
    )
    assert.ok(parsed.success)
    assert.equal(parsed.value.pageSize, 50)
  })

  it('rejects an invalid custom size even when the select is valid', () => {
    let parsed = s.parseSafe(
      pageSizeFormSchema,
      submission({ pageSize: '25', pageSizeCustom: '999' }),
    )
    assert.ok(!parsed.success, 'the custom field wins, so its invalid value must fail the parse')
  })

  it('defaults pageKey to an empty string and fails on a missing pageSize', () => {
    let parsed = s.parseSafe(pageSizeFormSchema, submission({}))
    assert.ok(!parsed.success)
  })

  it('rejects out-of-range, fractional, and non-numeric page sizes', () => {
    assert.ok(!s.parseSafe(pageSizeFormSchema, submission({ pageSize: '200' })).success)
    assert.ok(!s.parseSafe(pageSizeFormSchema, submission({ pageSize: '17.5' })).success)
    assert.ok(!s.parseSafe(pageSizeFormSchema, submission({ pageSize: 'too-big' })).success)
    assert.ok(!s.parseSafe(pageSizeFormSchema, submission({ pageSize: '' })).success)
  })

  it('selects only the declared fields, ignoring extra grid-state round-trips', () => {
    let parsed = s.parseSafe(
      pageSizeFormSchema,
      submission({
        pageKey: 'admin.users',
        pageSize: '25',
        _offset: '10',
        returnTo: '/admin/users',
      }),
    )
    assert.ok(parsed.success)
    assert.deepEqual(parsed.value, { pageKey: 'admin.users', pageSize: 25 })
  })
})
