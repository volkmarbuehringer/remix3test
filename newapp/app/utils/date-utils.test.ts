import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { isDateInPast, isWithinHours } from './date-utils.ts'

describe('isDateInPast', () => {
  it('returns true for a date in the past (yesterday)', () => {
    let now = new Date()
    let yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
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
