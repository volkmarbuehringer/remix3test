import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase, pool } from './setup.ts'
import { parseDuring, isSlotBookable, computeFullHourSlots, listDaysWithOfferings } from './appointofferings.ts'

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

// ---------------------------------------------------------------------------
// computeFullHourSlots — pure function tests (no database required)
// ---------------------------------------------------------------------------

describe('computeFullHourSlots', () => {
  it('returns full-hour slots for a single offering [480,1080)', () => {
    // Arrange: offering 8:00-18:00
    let ranges = [{ startMin: 480, endMin: 1080 }]

    // Act
    let result = computeFullHourSlots(ranges)

    // Assert: expects 8:00(480), 9:00(540), 10:00(600), 11:00(660),
    // 12:00(720), 13:00(780), 14:00(840), 15:00(900), 16:00(960), 17:00(1020)
    assert.deepEqual(result, [480, 540, 600, 660, 720, 780, 840, 900, 960, 1020])
  })

  it('returns correct slots for multiple offerings with gap [480,720)+[780,1080)', () => {
    // Arrange: two offerings with gap 12:00-13:00
    let ranges = [{ startMin: 480, endMin: 720 }, { startMin: 780, endMin: 1080 }]

    // Act
    let result = computeFullHourSlots(ranges)

    // Assert: 12:00(720) is NOT included because 720+60=780 > 720 (offering ends at 720)
    // 13:00(780) IS included because 780+60=840 ≤ 1080
    assert.deepEqual(result, [480, 540, 600, 660, 780, 840, 900, 960, 1020])
  })

  it('returns empty array for empty offerings', () => {
    // Arrange
    let ranges: { startMin: number; endMin: number }[] = []

    // Act
    let result = computeFullHourSlots(ranges)

    // Assert
    assert.deepEqual(result, [])
  })

  it('returns empty array when offering is too short for a full hour [500,530)', () => {
    // Arrange: only 30 min, not enough for a full hour
    let ranges = [{ startMin: 500, endMin: 530 }]

    // Act
    let result = computeFullHourSlots(ranges)

    // Assert
    assert.deepEqual(result, [])
  })

  it('handles non-aligned start time [500,800)', () => {
    // Arrange: offering starts at 500 (not a round hour), ends at 800
    // First full hour that fits: ceil(500/60)*60 = 540 (9:00)
    let ranges = [{ startMin: 500, endMin: 800 }]

    // Act
    let result = computeFullHourSlots(ranges)

    // Assert: 540, 600, 660, 720 (500-540 is only 40 min, not full hour; 720+60=780 ≤ 800)
    assert.deepEqual(result, [540, 600, 660, 720])
  })

  it('handles offering ending exactly on full-hour boundary [480,540)', () => {
    // Arrange: offering exactly 1 hour
    let ranges = [{ startMin: 480, endMin: 540 }]

    // Act
    let result = computeFullHourSlots(ranges)

    // Assert: 480+60=540 ≤ 540 ✓
    assert.deepEqual(result, [480])
  })
})

// ---------------------------------------------------------------------------
// listDaysWithOfferings — integration tests (requires database)
// ---------------------------------------------------------------------------

describe('listDaysWithOfferings', () => {
  let testDate1: number
  let testDate3: number
  let testResourceId = 9998

  before(async () => {
    await initializeAppDatabase()
    await pool.query(
      `INSERT INTO resources (id, description, created_at, updated_at)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (id) DO NOTHING`,
      [testResourceId, 'Testressource für listDaysWithOfferings', Date.now()],
    )
    testDate1 = Date.now() + 400 * 86_400_000
    testDate3 = testDate1 + 2 * 86_400_000
  })

  afterEach(async () => {
    try {
      await pool.query('DELETE FROM appointoffering WHERE resource_id = $1', [testResourceId])
    } catch {
      // Ignore cleanup errors
    }
  })

  it('returns distinct days with offerings for a resource in a date window', async () => {
    // Arrange: seed offerings on day1 and day3 (not day2)
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, $2, int4range(480, 1080, '[)'), $3, $3)`,
      [testDate1, testResourceId, Date.now()],
    )
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, $2, int4range(480, 720, '[)'), $3, $3)`,
      [testDate3, testResourceId, Date.now()],
    )

    // Act
    let result = await listDaysWithOfferings(db, testResourceId, testDate1, testDate3 + 86_400_000)

    // Assert: two days returned (day2 has no offerings)
    assert.equal(result.length, 2)
    assert.equal(result[0].day, testDate1)
    assert.equal(result[1].day, testDate3)
    assert.equal(result[0].ranges.length, 1)
    assert.deepEqual(result[0].ranges[0], { startMin: 480, endMin: 1080 })
  })

  it('returns empty array when resource has no offerings in the period', async () => {
    // Arrange: no offerings for this resource

    // Act
    let result = await listDaysWithOfferings(db, testResourceId, testDate1, testDate3 + 86_400_000)

    // Assert
    assert.deepEqual(result, [])
  })

  it('returns multiple ranges for a day with multiple offerings', async () => {
    // Arrange: two offerings on the same day
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, $2, int4range(480, 720, '[)'), $3, $3)`,
      [testDate1, testResourceId, Date.now()],
    )
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, $2, int4range(780, 1080, '[)'), $3, $3)`,
      [testDate1, testResourceId, Date.now()],
    )

    // Act
    let result = await listDaysWithOfferings(db, testResourceId, testDate1, testDate1 + 86_400_000)

    // Assert: one day with two ranges
    assert.equal(result.length, 1)
    assert.equal(result[0].ranges.length, 2)
    assert.deepEqual(result[0].ranges, [
      { startMin: 480, endMin: 720 },
      { startMin: 780, endMin: 1080 },
    ])
  })
})
