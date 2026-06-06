import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { createRateLimiter } from './rate-limiter.ts'

// ---------------------------------------------------------------------------
// RateLimiter unit tests
// Tests the TOCTOU-safe attempt() method and the existing check/set/reset API.
// ---------------------------------------------------------------------------

describe('RateLimiter - attempt()', () => {
  // -----------------------------------------------------------------------
  // attempt() — single call within window
  // -----------------------------------------------------------------------

  it('attempt() returns true on first call', () => {
    // Arrange
    let limiter = createRateLimiter({ windowMs: 5000 })

    // Act
    let result = limiter.attempt()

    // Assert
    assert.equal(result, true, 'first call should be allowed')
  })

  it('attempt() returns false when called again within the window', () => {
    // Arrange
    let limiter = createRateLimiter({ windowMs: 5000 })
    limiter.attempt() // first call — allowed

    // Act
    let result = limiter.attempt()

    // Assert
    assert.equal(result, false, 'second call within window should be rate-limited')
  })

  it('attempt() returns true after the window expires', async () => {
    // Arrange
    let limiter = createRateLimiter({ windowMs: 100 })
    limiter.attempt() // first call — allowed

    // Act
    await new Promise((r) => setTimeout(r, 150))
    let result = limiter.attempt()

    // Assert
    assert.equal(result, true, 'call after window expiry should be allowed')
  })

  // -----------------------------------------------------------------------
  // attempt() — per-user mode
  // -----------------------------------------------------------------------

  it('attempt() per-user isolates different users', () => {
    // Arrange
    let limiter = createRateLimiter({ windowMs: 5000, perUser: true })

    // Act
    let user1first = limiter.attempt(1) // allowed
    let user2first = limiter.attempt(2) // different user — allowed
    let user1second = limiter.attempt(1) // same user — rate-limited

    // Assert
    assert.equal(user1first, true, 'user 1 first call should be allowed')
    assert.equal(user2first, true, 'user 2 first call should be allowed')
    assert.equal(user1second, false, 'user 1 second call should be rate-limited')
  })

  it('attempt() per-user rejects null userId', () => {
    // Arrange
    let limiter = createRateLimiter({ windowMs: 5000, perUser: true })

    // Act & Assert
    assert.throws(
      () => limiter.attempt(),
      /userId is required/,
      'per-user limiter should throw when userId is missing',
    )
  })

  // -----------------------------------------------------------------------
  // attempt() — full cycle: allowed → blocked → allowed again
  // -----------------------------------------------------------------------

  it('attempt() allows after full block-wait cycle', async () => {
    // Arrange
    let limiter = createRateLimiter({ windowMs: 80 })

    // Act
    let first = limiter.attempt() // allowed
    let second = limiter.attempt() // blocked
    await new Promise((r) => setTimeout(r, 120))
    let third = limiter.attempt() // allowed again

    // Assert
    assert.equal(first, true, 'first call should be allowed')
    assert.equal(second, false, 'second call should be blocked')
    assert.equal(third, true, 'call after window expiry should be allowed again')
  })
})

describe('RateLimiter - check()', () => {
  it('check() returns allowed on first call', () => {
    let limiter = createRateLimiter({ windowMs: 5000 })

    let result = limiter.check()

    assert.deepEqual(result, { allowed: true })
  })

  it('check() returns allowed after set() when window has passed', async () => {
    let limiter = createRateLimiter({ windowMs: 50 })
    limiter.set()
    await new Promise((r) => setTimeout(r, 100))

    let result = limiter.check()

    assert.deepEqual(result, { allowed: true })
  })

  it('check() returns blocked with retryAfter after set() within window', () => {
    let limiter = createRateLimiter({ windowMs: 50000 })
    limiter.set()

    let result = limiter.check()

    assert.equal(result.allowed, false)
    assert.ok(typeof result.retryAfter === 'number', 'retryAfter should be a number')
    assert.ok(result.retryAfter! > 0, 'retryAfter should be positive')
  })

  it('check() without set() always returns allowed', () => {
    let limiter = createRateLimiter({ windowMs: 5000 })

    let r1 = limiter.check()
    let r2 = limiter.check()
    let r3 = limiter.check()

    assert.equal(r1.allowed, true)
    assert.equal(r2.allowed, true)
    assert.equal(r3.allowed, true)
  })
})

describe('RateLimiter - reset()', () => {
  it('reset() clears the rate limit state', () => {
    let limiter = createRateLimiter({ windowMs: 50000 })
    limiter.set()

    limiter.reset()

    let result = limiter.check()
    assert.deepEqual(result, { allowed: true })
  })

  it('reset() for a specific user clears only that user', () => {
    let limiter = createRateLimiter({ windowMs: 50000, perUser: true })
    limiter.set(1)
    limiter.set(2)

    limiter.reset(1)

    assert.deepEqual(limiter.check(1), { allowed: true }, 'user 1 should be reset')
    assert.equal(limiter.check(2).allowed, false, 'user 2 should still be rate-limited')
  })
})

describe('RateLimiter - perKey mode', () => {
  it('perKey attempt() returns true on first call', () => {
    let limiter = createRateLimiter({ windowMs: 5000, perKey: true })
    assert.equal(limiter.attempt('alice@test.com'), true)
  })

  it('perKey attempt() returns false within window for same key', () => {
    let limiter = createRateLimiter({ windowMs: 5000, perKey: true })
    assert.equal(limiter.attempt('alice@test.com'), true)
    assert.equal(limiter.attempt('alice@test.com'), false)
  })

  it('perKey isolates different keys', () => {
    let limiter = createRateLimiter({ windowMs: 5000, perKey: true })
    assert.equal(limiter.attempt('alice@test.com'), true)
    assert.equal(limiter.attempt('bob@test.com'), true)
    assert.equal(limiter.attempt('alice@test.com'), false)
    assert.equal(limiter.attempt('bob@test.com'), false)
  })

  it('perKey attempt() allows after window expiry', async () => {
    let limiter = createRateLimiter({ windowMs: 80, perKey: true })
    assert.equal(limiter.attempt('alice@test.com'), true)
    assert.equal(limiter.attempt('alice@test.com'), false)
    await new Promise((r) => setTimeout(r, 120))
    assert.equal(limiter.attempt('alice@test.com'), true)
  })

  it('perKey check()/set()/reset() cycle works', () => {
    let limiter = createRateLimiter({ windowMs: 50000, perKey: true })
    assert.deepEqual(limiter.check('key@test.com'), { allowed: true })
    limiter.set('key@test.com')
    assert.equal(limiter.check('key@test.com').allowed, false)
    limiter.reset('key@test.com')
    assert.deepEqual(limiter.check('key@test.com'), { allowed: true })
  })

  it('perKey rejects null key', () => {
    let limiter = createRateLimiter({ windowMs: 5000, perKey: true })
    assert.throws(
      () => limiter.attempt(),
      /key is required/,
      'perKey limiter should throw when key is missing',
    )
  })

  it('perKey and perUser limiters are independent', () => {
    let keyLimiter = createRateLimiter({ windowMs: 50000, perKey: true })
    let userLimiter = createRateLimiter({ windowMs: 50000, perUser: true })

    keyLimiter.set('shared')
    assert.equal(keyLimiter.check('shared').allowed, false)
    assert.deepEqual(userLimiter.check(1), { allowed: true }, 'user limiter unaffected by key limiter')
  })

  it('throws when both perUser and perKey are set', () => {
    assert.throws(
      () => createRateLimiter({ windowMs: 5000, perUser: true, perKey: true }),
      /Cannot set both/,
    )
  })
})
