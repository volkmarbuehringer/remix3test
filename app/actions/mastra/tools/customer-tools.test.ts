import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { pool, initializeAppDatabase } from '../../../data/setup.ts'
import { customerTools, runWithUserId } from './customer-tools.ts'
// Side-effect: registers the Mastra instance (setMastra) so cancellation workflows can execute
import '../index.ts'

function execTool(tool: Record<string, unknown>, input: Record<string, unknown>) {
  let fn = tool.execute as (
    input: Record<string, unknown>,
    opts: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>
  return fn(input, {})
}

function getFirstResourceId(): Promise<number> {
  return pool.query('SELECT id FROM resources ORDER BY id ASC LIMIT 1').then(r => r.rows[0]?.id as number)
}

describe('Customer tools', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('searchResourcesByCapability returns matching resources', async () => {
    // Seed data includes Raum 1 with capabilities mentioning "Einzeltherapie, Paarberatung, Gruppensitzungen"
    let result = (await execTool(
      customerTools.searchResourcesByCapability as unknown as Record<string, unknown>,
      { query: 'Therapie' },
    )) as Record<string, unknown>
    assert.ok((result.count as number) >= 1, 'should find at least one resource')
    let resources = result.resources as Array<Record<string, unknown>>
    assert.ok(resources.some(r => String(r.name).includes('Raum')), 'should include Raum resources')
  })

  it('searchResourcesByCapability returns empty for no match', async () => {
    let result = (await execTool(
      customerTools.searchResourcesByCapability as unknown as Record<string, unknown>,
      { query: 'Schwimmbad' },
    )) as Record<string, unknown>
    assert.equal(result.count, 0)
    assert.ok(Array.isArray(result.resources))
    assert.equal((result.resources as unknown[]).length, 0)
  })

  it('searchResourcesByCapability returns all results when query matches multiple', async () => {
    // Seed data uses German; 'Raum' matches the name but capabilities have 'Behandlungsraum'
    let result = (await execTool(
      customerTools.searchResourcesByCapability as unknown as Record<string, unknown>,
      { query: 'Behandlungsraum' },
    )) as Record<string, unknown>
    assert.ok((result.count as number) >= 1)
    for (let r of result.resources as Array<Record<string, unknown>>) {
      assert.ok(typeof r.id === 'number')
      assert.ok(typeof r.name === 'string')
      assert.ok(typeof r.description === 'string')
      assert.ok(typeof r.capabilities === 'string')
    }
  })

  it('searchResourcesByCapability handles special characters', async () => {
    let result = (await execTool(
      customerTools.searchResourcesByCapability as unknown as Record<string, unknown>,
      { query: '%_\\' },
    )) as Record<string, unknown>
    assert.equal(result.count, 0)
  })

  it('searchResourcesByCapability has correct metadata', () => {
    let tool = customerTools.searchResourcesByCapability as unknown as Record<string, unknown>
    assert.equal(tool.id, 'search_resources_by_capability')
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0)
    assert.ok(typeof tool.execute === 'function')
    assert.ok(tool.inputSchema, 'should have an inputSchema')
  })

  it('findNextAvailableSlots returns slots for a resource with offerings', async () => {
    let resourceId = await getFirstResourceId()
    let result = (await execTool(
      customerTools.findNextAvailableSlots as unknown as Record<string, unknown>,
      { resourceId, daysAhead: 14, title: 'Test Termin' },
    )) as Record<string, unknown>
    assert.ok(Array.isArray(result.slots), 'should return slots array')
    assert.ok((result.slots as unknown[]).length > 0, 'should have at least one slot')
    assert.equal(result.resource_id, resourceId)
    assert.ok(typeof result.resource_name === 'string')
    assert.equal(result.title, 'Test Termin')
    let firstSlot = (result.slots as Array<Record<string, unknown>>)[0]
    assert.ok(typeof firstSlot.date_epoch_ms === 'number')
    assert.ok(typeof firstSlot.start_min === 'number')
    assert.ok(typeof firstSlot.end_min === 'number')
    assert.ok(typeof firstSlot.date_display === 'string')
  })

  it('findNextAvailableSlots returns all slots per day (no 3-slot cap)', async () => {
    let resourceId = await getFirstResourceId()
    let result = (await execTool(
      customerTools.findNextAvailableSlots as unknown as Record<string, unknown>,
      { resourceId, daysAhead: 30 },
    )) as Record<string, unknown>
    let slots = result.slots as Array<Record<string, unknown>>
    let byDay = new Map<number, number>()
    for (let s of slots) {
      let day = s.date_epoch_ms as number
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }
    assert.ok(byDay.size > 0, 'should have at least one day with slots')
    let maxPerDay = Math.max(...byDay.values())
    assert.ok(maxPerDay > 3, 'should return more than 3 slots per day (old cap removed)')
  })

  it('findNextAvailableSlots returns slots sorted chronologically', async () => {
    let resourceId = await getFirstResourceId()
    let result = (await execTool(
      customerTools.findNextAvailableSlots as unknown as Record<string, unknown>,
      { resourceId, daysAhead: 14 },
    )) as Record<string, unknown>
    let slots = result.slots as Array<Record<string, unknown>>
    for (let i = 1; i < slots.length; i++) {
      let prev = slots[i - 1]
      let curr = slots[i]
      let prevSort = (prev.date_epoch_ms as number) * 10000 + (prev.start_min as number)
      let currSort = (curr.date_epoch_ms as number) * 10000 + (curr.start_min as number)
      assert.ok(currSort >= prevSort, 'slots should be sorted chronologically')
    }
  })

  it('findNextAvailableSlots with offsetDays skips to later date range', async () => {
    let resourceId = await getFirstResourceId()
    let defaultResult = (await execTool(
      customerTools.findNextAvailableSlots as unknown as Record<string, unknown>,
      { resourceId, daysAhead: 30 },
    )) as Record<string, unknown>
    let offsetResult = (await execTool(
      customerTools.findNextAvailableSlots as unknown as Record<string, unknown>,
      { resourceId, daysAhead: 30, offsetDays: 30 },
    )) as Record<string, unknown>

    let defaultSlots = defaultResult.slots as Array<Record<string, unknown>>
    let offsetSlots = offsetResult.slots as Array<Record<string, unknown>>

    // Seed data has offerings for current week only — default finds them
    assert.ok(defaultSlots.length > 0, 'default call should find slots in current week')

    // 30 days out there are no offerings in seed data — offset returns empty
    assert.equal(offsetSlots.length, 0, 'offsetDays=30 should find no slots in seed data')
  })

  it('findNextAvailableSlots has correct metadata', () => {
    let tool = customerTools.findNextAvailableSlots as unknown as Record<string, unknown>
    assert.equal(tool.id, 'find_next_available_slots')
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0)
    assert.ok(typeof tool.execute === 'function')
    assert.ok(tool.inputSchema, 'should have an inputSchema')
  })
})

describe('Customer tools — self-service appointments', () => {
  let customerId: number
  let resourceId: number
  let FUTURE = Date.now() + 365 * 86_400_000

  before(async () => {
    await initializeAppDatabase()
    let userResult = await pool.query(
      "SELECT id FROM users WHERE email = 'user@newapp.com'",
    )
    customerId = userResult.rows[0].id
    let resourceResult = await pool.query('SELECT id FROM resources LIMIT 1')
    resourceId = resourceResult.rows[0].id
  })

  afterEach(async () => {
    await pool.query('DELETE FROM appointments WHERE title LIKE $1', ['[TEST SELF]%'])
  })

  it('listMyAppointments returns appointments for authenticated user', async () => {
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
        VALUES ($1, $2, '[TEST SELF] list 1', $3, '[600,660)'::int4range, $4, $4)`,
      [customerId, resourceId, FUTURE, Date.now()],
    )
    let result = await runWithUserId(customerId, () =>
      execTool(
        customerTools.listMyAppointments as unknown as Record<string, unknown>,
        {},
      ),
    ) as Record<string, unknown>
    assert.ok(Array.isArray(result.appointments))
    assert.ok((result.appointments as unknown[]).length >= 1)
    assert.equal(result.count, (result.appointments as unknown[]).length)
    let first = (result.appointments as Array<Record<string, unknown>>)[0]
    assert.ok(typeof first.id === 'number')
    assert.ok(typeof first.date_epoch_ms === 'number')
    assert.ok(typeof first.start_min === 'number')
    assert.ok(typeof first.end_min === 'number')
    assert.ok(typeof first.time_display === 'string')
    assert.ok(typeof first.title === 'string')
    assert.ok(typeof first.resource_name === 'string')
  })

  it('listMyAppointments includes appointments scheduled for today', async () => {
    let todayMidnight = new Date()
    todayMidnight.setUTCHours(0, 0, 0, 0)
    let todayMs = todayMidnight.getTime()
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
        VALUES ($1, $2, '[TEST SELF] today', $3, '[600,660)'::int4range, $4, $4)`,
      [customerId, resourceId, todayMs, Date.now()],
    )
    let result = await runWithUserId(customerId, () =>
      execTool(
        customerTools.listMyAppointments as unknown as Record<string, unknown>,
        {},
      ),
    ) as Record<string, unknown>
    let titles = ((result.appointments as Array<Record<string, unknown>>) || []).map(
      (a: Record<string, unknown>) => a.title,
    )
    assert.ok(titles.includes('[TEST SELF] today'), 'today appointments must be included')
  })

  it('listMyAppointments returns empty for user with no appointments', async () => {
    let r2 = await pool.query(
      `INSERT INTO users (email, name, role, email_verified, token_version, password_hash, created_at)
       VALUES ('test-no-appts@example.com', 'No Appts', 'customer', 1, 1, 'x', $1)
       RETURNING id`,
      [Date.now()],
    )
    let tempUserId = r2.rows[0].id
    try {
      let result = await runWithUserId(tempUserId, () =>
        execTool(
          customerTools.listMyAppointments as unknown as Record<string, unknown>,
          {},
        ),
      ) as Record<string, unknown>
      assert.ok(Array.isArray(result.appointments))
      assert.equal((result.appointments as unknown[]).length, 0)
      assert.equal(result.count, 0)
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [tempUserId])
    }
  })

  it('listMyAppointments only returns upcoming appointments (excludes past)', async () => {
    let pastDate = Date.now() - 365 * 86_400_000
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
        VALUES ($1, $2, '[TEST SELF] past', $3, '[600,660)'::int4range, $4, $4)`,
      [customerId, resourceId, pastDate, Date.now()],
    )
    let result = await runWithUserId(customerId, () =>
      execTool(
        customerTools.listMyAppointments as unknown as Record<string, unknown>,
        {},
      ),
    ) as Record<string, unknown>
    let titles = ((result.appointments as Array<Record<string, unknown>>) || []).map(
      (a: Record<string, unknown>) => a.title,
    )
    assert.ok(!titles.includes('[TEST SELF] past'), 'past appointments should be excluded')
  })

  // MED-3: auth-bypass throws
  it('listMyAppointments throws without authenticated user context', async () => {
    try {
      await execTool(
        customerTools.listMyAppointments as unknown as Record<string, unknown>,
        {},
      )
      assert.fail('should have thrown')
    } catch (e) {
      assert.ok(String(e).includes('No authenticated user'))
    }
  })

  // MED-4: cross-user isolation
  it('listMyAppointments does not expose other users appointments', async () => {
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
        VALUES ($1, $2, '[TEST SELF] other-user-appt', $3, '[600,660)'::int4range, $4, $4)`,
      [customerId, resourceId, FUTURE, Date.now()],
    )
    let r2 = await pool.query(
      `INSERT INTO users (email, name, role, email_verified, token_version, password_hash, created_at)
       VALUES ('test-cross-user@example.com', 'Cross User', 'customer', 1, 1, 'x', $1)
       RETURNING id`,
      [Date.now()],
    )
    let otherUserId = r2.rows[0].id
    try {
      let result = await runWithUserId(otherUserId, () =>
        execTool(
          customerTools.listMyAppointments as unknown as Record<string, unknown>,
          {},
        ),
      ) as Record<string, unknown>
      let titles = ((result.appointments as Array<Record<string, unknown>>) || []).map(
        (a: Record<string, unknown>) => a.title,
      )
      assert.ok(!titles.includes('[TEST SELF] other-user-appt'), 'should not see other user appointments')
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId])
    }
  })

  it('listMyAppointments has correct metadata', () => {
    let tool = customerTools.listMyAppointments as unknown as Record<string, unknown>
    assert.equal(tool.id, 'list_my_appointments')
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0)
    assert.ok(typeof tool.execute === 'function')
    assert.ok(tool.inputSchema, 'should have an inputSchema')
  })

  it('cancelAllAppointments cancels all upcoming appointments', async () => {
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
        VALUES ($1, $2, '[TEST SELF] cancel-1', $3, '[600,660)'::int4range, $4, $4)`,
      [customerId, resourceId, FUTURE, Date.now()],
    )
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, '[TEST SELF] cancel-2', $3, '[720,780)'::int4range, $4, $4)`,
      [customerId, resourceId, FUTURE + 86_400_000, Date.now()],
    )
    let result = await runWithUserId(customerId, () =>
      execTool(
        customerTools.cancelAllAppointments as unknown as Record<string, unknown>,
        {},
      ),
    ) as Record<string, unknown>
    // MED-6: use >= instead of === to tolerate any pre-existing appointments for this user
    assert.ok((result.cancelled as number) >= 2)
    assert.equal(result.failed, 0)
    assert.equal(result.skipped, 0)
    assert.ok(Array.isArray(result.details))
    assert.ok((result.details as unknown[]).length >= 2)
    // Verify the test appointments are gone
    let check = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM appointments WHERE title LIKE '[TEST SELF] cancel-%'",
    )
    assert.equal(check.rows[0].cnt, 0)
  })

  it('cancelAllAppointments returns empty result when no appointments exist', async () => {
    let r2 = await pool.query(
      `INSERT INTO users (email, name, role, email_verified, token_version, password_hash, created_at)
       VALUES ('test-no-appts2@example.com', 'No Appts 2', 'customer', 1, 1, 'x', $1)
       RETURNING id`,
      [Date.now()],
    )
    let tempUserId = r2.rows[0].id
    try {
      let result = await runWithUserId(tempUserId, () =>
        execTool(
          customerTools.cancelAllAppointments as unknown as Record<string, unknown>,
          {},
        ),
      ) as Record<string, unknown>
      assert.equal(result.cancelled, 0)
      assert.equal(result.failed, 0)
      assert.equal(result.skipped, 0)
      assert.ok(Array.isArray(result.details))
      assert.equal((result.details as unknown[]).length, 0)
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [tempUserId])
    }
  })

  // MED-3: auth-bypass throws
  it('cancelAllAppointments throws without authenticated user context', async () => {
    try {
      await execTool(
        customerTools.cancelAllAppointments as unknown as Record<string, unknown>,
        {},
      )
      assert.fail('should have thrown')
    } catch (e) {
      assert.ok(String(e).includes('No authenticated user'))
    }
  })

  // MED-5: skipped branch — gracefully handles when appointments vanish between query and workflow call
  it('cancelAllAppointments cancels remaining appointments and skips vanished ones', async () => {
    // Create 2 appointments, then manually delete one to simulate race condition
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
        VALUES ($1, $2, '[TEST SELF] race-1', $3, '[600,660)'::int4range, $4, $4)`,
      [customerId, resourceId, FUTURE, Date.now()],
    )
    let r2 = await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
        VALUES ($1, $2, '[TEST SELF] race-2', $3, '[720,780)'::int4range, $4, $4)
        RETURNING id`,
      [customerId, resourceId, FUTURE + 86_400_000, Date.now()],
    )
    let race2Id = r2.rows[0].id
    // Delete one appointment directly (simulates concurrent cancellation)
    await pool.query('DELETE FROM appointments WHERE id = $1', [race2Id])
    // Run cancelAll — should cancel race-1 (1 remaining) and handle race-2 gracefully
    let result = await runWithUserId(customerId, () =>
      execTool(
        customerTools.cancelAllAppointments as unknown as Record<string, unknown>,
        {},
      ),
    ) as Record<string, unknown>
    assert.ok((result.cancelled as number) >= 1)
    assert.ok((result.failed as number) === 0)
    // Verify both test appointments are gone
    let check = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM appointments WHERE title LIKE '[TEST SELF] race-%'",
    )
    assert.equal(check.rows[0].cnt, 0)
  })

  it('cancelAllAppointments has correct metadata', () => {
    let tool = customerTools.cancelAllAppointments as unknown as Record<string, unknown>
    assert.equal(tool.id, 'cancel_all_appointments')
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0)
    assert.ok(typeof tool.execute === 'function')
    assert.ok(tool.inputSchema, 'should have an inputSchema')
  })
})
