import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { pool, initializeAppDatabase } from '../../../data/setup.ts'
import { bookingTools } from './booking-tools.ts'
import { getTodayUtcMidnight, MS_PER_DAY } from '../../../utils/date-utils.ts'

function execTool(tool: Record<string, unknown>, input: Record<string, unknown>) {
  let fn = tool.execute as (
    input: Record<string, unknown>,
    opts: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>
  return fn(input, {})
}

describe('Booking tools', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('createAppointment creates successfully', async () => {
    let userResult = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['user'])
    let resourceResult = await pool.query('SELECT id FROM resources ORDER BY id ASC LIMIT 1')
    if (userResult.rows.length === 0 || resourceResult.rows.length === 0) return

    let userId = userResult.rows[0].id as number
    let resourceId = resourceResult.rows[0].id as number
    let futureDate = getTodayUtcMidnight() + 7 * MS_PER_DAY

    let result = (await execTool(
      bookingTools.createAppointment as unknown as Record<string, unknown>,
      { resourceId, date: futureDate, startMin: 600, title: 'Test Termin', userId },
    )) as Record<string, unknown>

    assert.ok(result.success === true, 'should succeed')
    assert.ok(typeof result.id === 'number', 'should return an id')
    assert.equal(result.date, futureDate)
    assert.equal(result.start_min, 600)
    assert.equal(result.end_min, 660)

    // Cleanup
    await pool.query('DELETE FROM appointments WHERE id = $1', [result.id])
  })

  it('createAppointment returns collision error for overlapping slots', async () => {
    let userResult = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['user'])
    let resourceResult = await pool.query('SELECT id FROM resources ORDER BY id ASC LIMIT 1')
    if (userResult.rows.length === 0 || resourceResult.rows.length === 0) return

    let userId = userResult.rows[0].id as number
    let resourceId = resourceResult.rows[0].id as number
    let futureDate = getTodayUtcMidnight() + 7 * MS_PER_DAY

    // Clean up any leftover rows from previous runs
    await pool.query('DELETE FROM appointments WHERE date = $1 AND resource_id = $2 AND start_min = 600', [futureDate, resourceId])

    // First appointment
    let first = (await execTool(
      bookingTools.createAppointment as unknown as Record<string, unknown>,
      { resourceId, date: futureDate, startMin: 600, title: 'Erster Termin', userId },
    )) as Record<string, unknown>
    assert.ok(first.success === true)

    // Second appointment — same resource, same day, overlapping time
    let second = (await execTool(
      bookingTools.createAppointment as unknown as Record<string, unknown>,
      { resourceId, date: futureDate, startMin: 600, title: 'Zweiter Termin', userId },
    )) as Record<string, unknown>
    assert.equal(second.error, 'collision')
    assert.ok(typeof second.message === 'string')

    // Cleanup
    await pool.query('DELETE FROM appointments WHERE id = $1', [first.id])
  })

  it('createAppointment returns past_date error for past dates', async () => {
    let userResult = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['user'])
    let resourceResult = await pool.query('SELECT id FROM resources ORDER BY id ASC LIMIT 1')
    if (userResult.rows.length === 0 || resourceResult.rows.length === 0) return

    let userId = userResult.rows[0].id as number
    let resourceId = resourceResult.rows[0].id as number
    let pastDate = getTodayUtcMidnight() - 7 * MS_PER_DAY

    let result = (await execTool(
      bookingTools.createAppointment as unknown as Record<string, unknown>,
      { resourceId, date: pastDate, startMin: 600, title: 'Vergangener Termin', userId },
    )) as Record<string, unknown>

    assert.equal(result.error, 'past_date')
  })

  it('createAppointment has correct metadata', () => {
    let tool = bookingTools.createAppointment as unknown as Record<string, unknown>
    assert.equal(tool.id, 'create_appointment')
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0)
    assert.ok(typeof tool.execute === 'function')
    assert.ok(tool.inputSchema, 'should have an inputSchema')
  })
})
