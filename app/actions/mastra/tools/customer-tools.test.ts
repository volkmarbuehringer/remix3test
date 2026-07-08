import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { pool, initializeAppDatabase } from '../../../data/setup.ts'
import { customerTools } from './customer-tools.ts'

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

  it('findNextAvailableSlots limits to 3 slots per day', async () => {
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
    for (let count of byDay.values()) {
      assert.ok(count <= 3, 'each day should have at most 3 slots')
    }
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
