import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from '../db.ts'
import { pool } from './test-pool.ts'
import {
  countOfferingConfigs,
  listOfferingConfigs,
  getOfferingConfig,
  listOfferingConfigResources,
} from './offering-configs-queries.ts'

describe('offering-configs-queries', () => {
  let testResourceId: number

  before(async () => {
    await initializeAppDatabase()
    let resourceResult = await pool.query('SELECT id, name FROM resources LIMIT 1')
    testResourceId = resourceResult.rows[0].id
  })

  afterEach(async () => {
    await pool.query('DELETE FROM offering_configs WHERE resource_id = $1 AND resource_id > 100', [
      testResourceId,
    ])
  })

  it('listOfferingConfigResources returns resource options', async () => {
    let rows = await listOfferingConfigResources(db)
    assert.ok(rows.length >= 1)
    assert.ok(rows.some((r) => r.id === testResourceId))
  })

  it('countOfferingConfigs returns total count', async () => {
    let count = await countOfferingConfigs(db, {})
    assert.ok(typeof count === 'number')
    assert.ok(count >= 0)
  })

  it('getOfferingConfig returns row for existing id', async () => {
    let configResult = await pool.query('SELECT id FROM offering_configs WHERE resource_id = $1', [
      testResourceId,
    ])
    if (configResult.rows.length > 0) {
      let configId = configResult.rows[0].id
      let row = await getOfferingConfig(db, configId)
      assert.ok(row !== undefined)
      assert.equal(row!.resource_id, testResourceId)
      assert.ok(typeof row!.rules === 'object')
    }
  })

  it('getOfferingConfig returns undefined for nonexistent id', async () => {
    let row = await getOfferingConfig(db, -1)
    assert.equal(row, undefined)
  })

  it('listOfferingConfigs returns rows', async () => {
    let rows = await listOfferingConfigs(db, {
      offset: 0,
      pageSize: 100,
      column: 'id',
      direction: 'asc',
      orderByColumns: {
        id: 'oc.id',
        resource_description: 'r.name',
        created_at: 'oc.created_at',
        updated_at: 'oc.updated_at',
      },
    })
    assert.ok(rows.length >= 1)
    assert.ok(typeof rows[0].rules === 'object')
    assert.ok(typeof rows[0].id === 'number')
  })

  it('listOfferingConfigs returns empty for id < 0', async () => {
    let rows = await listOfferingConfigs(db, {
      offset: 0,
      pageSize: 100,
      column: 'id',
      direction: 'asc',
      filter: 'NONEXISTENT_RESOURCE_NAME_ZZZZ',
      orderByColumns: {
        id: 'oc.id',
        resource_description: 'r.name',
        created_at: 'oc.created_at',
        updated_at: 'oc.updated_at',
      },
    })
    assert.equal(rows.length, 0)
  })
})
