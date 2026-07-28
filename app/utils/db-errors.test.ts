import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { isConstraintViolation, isExclusionConstraintError, type PgErr } from './db-errors.ts'

function pgError(overrides: Partial<{ code: string; message: string; constraint: string }>): Error {
  return { ...{ code: '23503', message: 'violation' }, ...overrides } as unknown as Error
}

describe('db-errors', () => {
  describe('isConstraintViolation', () => {
    it('returns true for foreign key violation code', () => {
      assert.ok(isConstraintViolation(pgError({ code: '23503' })))
    })

    it('returns true for restrict violation code', () => {
      assert.ok(isConstraintViolation(pgError({ code: '23001' })))
    })

    it('returns false for unrelated error code', () => {
      assert.ok(!isConstraintViolation(pgError({ code: '42703' })))
    })

    it('returns false for null input', () => {
      assert.ok(!isConstraintViolation(null))
    })

    it('returns false for undefined input', () => {
      assert.ok(!isConstraintViolation(undefined))
    })

    it('returns false for a plain Error without code', () => {
      assert.ok(!isConstraintViolation(new Error('boom')))
    })
  })

  describe('isExclusionConstraintError', () => {
    it('returns true when constraint matches no_overlapping_seats', () => {
      assert.ok(isExclusionConstraintError(pgError({ constraint: 'no_overlapping_seats' })))
    })

    it('returns true for exclusion violation code 23P01', () => {
      assert.ok(isExclusionConstraintError(pgError({ code: '23P01' })))
    })

    it('returns true when message contains conflicts with key', () => {
      assert.ok(isExclusionConstraintError(pgError({ message: 'conflicts with key' })))
    })

    it('returns false for unrelated error', () => {
      assert.ok(!isExclusionConstraintError(pgError({ code: '23503' })))
    })
  })

  describe('cause-chain traversal', () => {
    it('finds constraint violation in one-level cause', () => {
      let inner = pgError({ code: '23503' })
      let outer = pgError({ code: 'P0001', message: 'outer' })
      outer.cause = inner
      assert.ok(isConstraintViolation(outer))
    })

    it('finds constraint violation in nested cause chain', () => {
      let inner = pgError({ code: '23503' })
      let middle = pgError({ code: 'P0001', message: 'middle' })
      middle.cause = inner
      let outer = pgError({ code: 'P0001', message: 'outer' })
      ;(outer as any).cause = middle
      assert.ok(isConstraintViolation(outer))
    })

    it('returns false when cause chain has no matching code', () => {
      let inner = pgError({ code: '42703' })
      let outer = pgError({ code: 'P0001' })
      outer.cause = inner
      assert.ok(!isConstraintViolation(outer))
    })
  })
})
