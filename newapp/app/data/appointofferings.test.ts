import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase, pool } from './setup.ts'
import { parseDuring, isSlotBookable } from './appointofferings.ts'

// ---------------------------------------------------------------------------
// parseDuring — pure function tests
// These tests verify the int4range string parser used to extract offering
// time bounds. No database required.
// ---------------------------------------------------------------------------

describe('parseDuring', () => {
  // -----------------------------------------------------------------------
  // Valid input formats
  // -----------------------------------------------------------------------

  it('parses normal range "[480,1080)" into startMin/endMin', () => {
    // Arrange
    // Act
    let result = parseDuring('[480,1080)')

    // Assert
    assert.deepEqual(result, { startMin: 480, endMin: 1080 })
  })

  it('parses full-day range "[0,1440)"', () => {
    // Arrange
    // Act
    let result = parseDuring('[0,1440)')

    // Assert
    assert.deepEqual(result, { startMin: 0, endMin: 1440 })
  })

  it('parses single-digit bounds "[0,15)"', () => {
    // Arrange
    // Act
    let result = parseDuring('[0,15)')

    // Assert
    assert.deepEqual(result, { startMin: 0, endMin: 15 })
  })

  it('parses range with whitespace via fallback regex "[480 , 960)"', () => {
    // Arrange — the standard regex won't match due to spaces, but the
    // fallback regex handles whitespace around the comma.
    // Act
    let result = parseDuring('[480 , 960)')

    // Assert
    assert.deepEqual(result, { startMin: 480, endMin: 960 })
  })

  // -----------------------------------------------------------------------
  // Invalid inputs — should return null
  // -----------------------------------------------------------------------

  it('returns null for empty string', () => {
    // Arrange
    // Act
    let result = parseDuring('')

    // Assert
    assert.equal(result, null)
  })

  it('returns null for invalid format "not-a-range"', () => {
    // Arrange
    // Act
    let result = parseDuring('not-a-range')

    // Assert
    assert.equal(result, null)
  })

  it('returns null for wrong bracket type "(480,1080]"', () => {
    // Arrange — the format uses open bracket at start and close paren at end
    // Act
    let result = parseDuring('(480,1080]')

    // Assert
    assert.equal(result, null)
  })

  it('returns null for null input', () => {
    // Arrange — type cast to simulate what the PostgreSQL driver might pass
    // Act
    let result = parseDuring(null as any)

    // Assert
    assert.equal(result, null)
  })

  it('returns null for undefined input', () => {
    // Arrange
    // Act
    let result = parseDuring(undefined as any)

    // Assert
    assert.equal(result, null)
  })
})

// ---------------------------------------------------------------------------
// isSlotBookable — integration tests (requires database)
// These tests verify that slot booking validation correctly checks offering
// ranges in the database.
// ---------------------------------------------------------------------------

describe('isSlotBookable', () => {
  let testDate: number

  before(async () => {
    await initializeAppDatabase()
    // Use a date far in the future to avoid collisions with demo seed data
    testDate = Date.now() + 365 * 86_400_000
  })

  // Clean up all seeded offerings after each test so each test starts fresh
  afterEach(async () => {
    try {
      await pool.query('DELETE FROM appointoffering WHERE day = $1', [testDate])
    } catch {
      // Ignore cleanup errors
    }
  })

  it('returns true when slot is fully within offering [480,1080) checking 480-540', async () => {
    // Arrange: seed a single offering [480,1080) for the test date
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, 1, int4range(480, 1080, '[)'), $2, $2)`,
      [testDate, Date.now()],
    )

    // Act: check a slot that falls entirely within the offering
    let result = await isSlotBookable(db, testDate, 1, 480, 540)

    // Assert
    assert.equal(result, true, '480-540 should be bookable inside [480,1080)')
  })

  it('returns false when slot is entirely outside offering [480,1080) checking 0-60', async () => {
    // Arrange: seed a single offering [480,1080) for the test date
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, 1, int4range(480, 1080, '[)'), $2, $2)`,
      [testDate, Date.now()],
    )

    // Act: check a slot before the offering starts
    let result = await isSlotBookable(db, testDate, 1, 0, 60)

    // Assert
    assert.equal(result, false, '0-60 should not be bookable outside [480,1080)')
  })

  it('returns false when slot uses upper-bound exclusive minute [480,1080) checking 1080-1140', async () => {
    // Arrange: seed a single offering [480,1080) — 1080 is the exclusive upper bound
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, 1, int4range(480, 1080, '[)'), $2, $2)`,
      [testDate, Date.now()],
    )

    // Act: check a slot starting at the exclusive upper bound
    let result = await isSlotBookable(db, testDate, 1, 1080, 1140)

    // Assert
    assert.equal(result, false, '1080-1140 should not be bookable (1080 is exclusive upper bound)')
  })

  it('returns false when no offerings exist for the date', async () => {
    // Arrange: no seeding — date has no offerings at all

    // Act
    let result = await isSlotBookable(db, testDate, 1, 480, 540)

    // Assert
    assert.equal(result, false, 'slot should not be bookable when no offerings exist')
  })

  it('returns true when slot falls within one of multiple offerings [480,600)+[720,840) checking 540-570', async () => {
    // Arrange: seed two non-overlapping offerings with a gap between them
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, 1, int4range(480, 600, '[)'), $2, $2)`,
      [testDate, Date.now()],
    )
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, 1, int4range(720, 840, '[)'), $2, $2)`,
      [testDate, Date.now()],
    )

    // Act: check a slot within the first offering range
    let result = await isSlotBookable(db, testDate, 1, 540, 570)

    // Assert
    assert.equal(result, true, '540-570 should be bookable inside [480,600)')
  })

  it('returns false when slot falls in the gap between offerings [480,600)+[720,840) checking 600-660', async () => {
    // Arrange: seed two non-overlapping offerings with a gap [600,720)
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, 1, int4range(480, 600, '[)'), $2, $2)`,
      [testDate, Date.now()],
    )
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, 1, int4range(720, 840, '[)'), $2, $2)`,
      [testDate, Date.now()],
    )

    // Act: check a slot in the gap between the two offerings
    let result = await isSlotBookable(db, testDate, 1, 600, 660)

    // Assert
    assert.equal(result, false, '600-660 should not be bookable in the gap between offerings')
  })
})
