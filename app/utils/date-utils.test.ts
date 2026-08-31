import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  isDateInPast,
  isWithinHours,
  generateMinOptions,
  formatDateDE,
  formatUtcDateDE,
  formatUtcPeriodDayDE,
  parseIsoDateUtc,
  getPeriodRange,
  getTodayUtcMidnight,
} from './date-utils.ts'

describe('isDateInPast', () => {
  it('returns true for a date in the past (yesterday)', () => {
    let now = new Date()
    let yesterday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
    )
    assert.ok(isDateInPast(yesterday.getTime()), 'yesterday should be in the past')
  })

  it('returns false for today (current UTC day)', () => {
    let now = new Date()
    let todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    assert.ok(!isDateInPast(todayMidnight), 'today should NOT be in the past')
  })

  it('returns false for a date in the future (tomorrow)', () => {
    let now = new Date()
    let tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    assert.ok(!isDateInPast(tomorrow.getTime()), 'tomorrow should NOT be in the past')
  })

  it('returns false for a far future date', () => {
    let farFuture = Date.UTC(2099, 0, 1)
    assert.ok(!isDateInPast(farFuture), 'far future should NOT be in the past')
  })

  it('returns true for a far past date', () => {
    let farPast = Date.UTC(2020, 0, 1)
    assert.ok(isDateInPast(farPast), 'far past should be in the past')
  })

  it('handles boundary at UTC midnight correctly', () => {
    // Exactly at midnight UTC today should not be in the past
    let now = new Date()
    let todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    assert.ok(!isDateInPast(todayMidnight), 'today at midnight is not in the past')

    // One millisecond before midnight UTC today (yesterday 23:59:59.999) is in the past
    let beforeMidnight = todayMidnight - 1
    assert.ok(isDateInPast(beforeMidnight), 'just before midnight yesterday IS in the past')
  })
})

describe('isWithinHours', () => {
  it('returns true for a timestamp 25 hours in the future', () => {
    let future = Date.now() + 25 * 3600000
    assert.ok(isWithinHours(future, 24), '25h in future should be within 24h window')
  })

  it('returns false for a timestamp 23 hours in the future', () => {
    let future = Date.now() + 23 * 3600000
    assert.ok(!isWithinHours(future, 24), '23h in future should NOT be within 24h window')
  })

  it('returns false for a timestamp that has already passed', () => {
    let past = Date.now() - 3600000
    assert.ok(!isWithinHours(past, 24), '1h in the past should NOT be within 24h window')
  })

  it('returns true for exactly 24 hours in the future', () => {
    let future = Date.now() + 24 * 3600000
    assert.ok(isWithinHours(future, 24), 'exactly 24h in future should be within window')
  })

  it('returns false for exactly 24 hours minus 1ms', () => {
    let nearFuture = Date.now() + 24 * 3600000 - 1
    assert.ok(!isWithinHours(nearFuture, 24), '24h - 1ms should NOT be within window')
  })

  it('returns true for a far future timestamp', () => {
    let farFuture = Date.now() + 365 * 24 * 3600000
    assert.ok(isWithinHours(farFuture, 24), '1 year in future should be within window')
  })

  it('works with different hour windows', () => {
    let future = Date.now() + 2 * 3600000
    assert.ok(isWithinHours(future, 1), '2h in future is within 1h window')
    assert.ok(!isWithinHours(future, 3), '2h in future is NOT within 3h window')
  })
})

describe('generateMinOptions', () => {
  it('generates 0-based sequence', () => {
    assert.deepEqual(generateMinOptions(3, 10), [0, 10, 20])
  })

  it('applies offset correctly', () => {
    assert.deepEqual(generateMinOptions(3, 10, 1), [10, 20, 30])
  })

  it('matches 15-min appointment intervals (96 slots, offset 0)', () => {
    let result = generateMinOptions(96, 15)
    assert.equal(result.length, 96)
    assert.equal(result[0], 0)
    assert.equal(result[95], 1425)
  })

  it('matches 15-min appointment end intervals (96 slots, offset 1)', () => {
    let result = generateMinOptions(96, 15, 1)
    assert.equal(result.length, 96)
    assert.equal(result[0], 15)
    assert.equal(result[95], 1440)
  })

  it('matches 60-min offering intervals (24 slots, offset 0)', () => {
    let result = generateMinOptions(24, 60)
    assert.equal(result.length, 24)
    assert.equal(result[0], 0)
    assert.equal(result[23], 1380)
  })

  it('matches 60-min offering end intervals (24 slots, offset 1)', () => {
    let result = generateMinOptions(24, 60, 1)
    assert.equal(result.length, 24)
    assert.equal(result[0], 60)
    assert.equal(result[23], 1440)
  })

  it('returns empty array for count=0', () => {
    assert.deepEqual(generateMinOptions(0, 15), [])
  })

  it('returns empty array for negative count', () => {
    assert.deepEqual(generateMinOptions(-1, 15), [])
  })
})

describe('formatDateDE', () => {
  it('returns an em dash for null and undefined', () => {
    assert.equal(formatDateDE(null), '\u2014')
    assert.equal(formatDateDE(undefined), '\u2014')
  })

  it('returns an em dash for invalid timestamps', () => {
    assert.equal(formatDateDE(NaN), '\u2014')
  })

  it('renders a weekday-prefixed German date for valid input', () => {
    assert.equal(formatDateDE(Date.UTC(2026, 0, 15)), 'Do., 15.01.2026')
  })
})

describe('formatUtcDateDE', () => {
  it('returns an em dash for null and invalid input', () => {
    assert.equal(formatUtcDateDE(null), '\u2014')
    assert.equal(formatUtcDateDE(NaN), '\u2014')
  })

  it('renders the UTC calendar day deterministically', () => {
    assert.equal(formatUtcDateDE(Date.UTC(2026, 0, 31, 23, 30)), '31.01.2026')
  })
})

describe('formatUtcPeriodDayDE', () => {
  it('renders a long German UTC day without leading zero', () => {
    assert.equal(formatUtcPeriodDayDE(Date.UTC(2026, 0, 1)), '1. Januar 2026')
    assert.equal(formatUtcPeriodDayDE(Date.UTC(2026, 0, 31)), '31. Januar 2026')
  })

  it('renders leap day correctly', () => {
    assert.equal(formatUtcPeriodDayDE(Date.UTC(2024, 1, 29)), '29. Februar 2024')
  })
})

describe('parseIsoDateUtc', () => {
  it('accepts real calendar dates and returns UTC midnight', () => {
    assert.equal(parseIsoDateUtc('2026-01-31'), Date.UTC(2026, 0, 31))
  })

  it('accepts leap days', () => {
    assert.equal(parseIsoDateUtc('2024-02-29'), Date.UTC(2024, 1, 29))
  })

  it('rejects non-calendar dates that would roll over', () => {
    assert.equal(parseIsoDateUtc('2024-02-31'), null)
    assert.equal(parseIsoDateUtc('2026-04-31'), null)
    assert.equal(parseIsoDateUtc('2026-13-01'), null)
  })

  it('rejects malformed strings', () => {
    assert.equal(parseIsoDateUtc('2026-1-1'), null)
    assert.equal(parseIsoDateUtc('not-a-date'), null)
    assert.equal(parseIsoDateUtc(''), null)
  })
})

describe('getPeriodRange', () => {
  it('returns the current UTC day for period today', () => {
    let range = getPeriodRange('today')
    let start = getTodayUtcMidnight()
    assert.ok(range, 'today should resolve to a range')
    assert.equal(range!.startMs, start)
    assert.equal(range!.endMs, start + 86_400_000)
  })

  it('returns null for an unknown period', () => {
    assert.equal(getPeriodRange('fortnight'), null)
  })
})
