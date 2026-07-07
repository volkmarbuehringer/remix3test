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
})
