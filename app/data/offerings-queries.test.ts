import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from '../db.ts'
import { pool } from './test-pool.ts'
import {
  listOfferings,
  fetchOfferingEditRow,
  listResources,
  createOffering,
  updateOffering,
  deleteOffering,
  listResourceIdsWithConfigs,
  deletePastOfferings,
} from './offerings-queries.ts'

describe('offerings-queries', () => {
  let testResourceId: number
  let offeringDate: number

  before(async () => {
    await initializeAppDatabase()
    let resourceResult = await pool.query('SELECT id FROM resources LIMIT 1')
    testResourceId = resourceResult.rows[0].id
    offeringDate = Date.now() + 365 * 86_400_000
  })

  afterEach(async () => {
    await pool.query('DELETE FROM appointoffering WHERE day = $1', [offeringDate])
  })

  it('createOffering creates and returns id', async () => {
    let id = await createOffering(db, {
      dayMs: offeringDate,
      resourceId: testResourceId,
      during: '[480,1080)',
    })
    assert.ok(typeof id === 'number')
  })

  it('fetchOfferingEditRow returns row for existing id', async () => {
    let id = await createOffering(db, {
      dayMs: offeringDate,
      resourceId: testResourceId,
      during: '[480,1080)',
    })
    let row = await fetchOfferingEditRow(db, String(id))
    assert.ok(row !== null)
    assert.equal(Number(row!.resource_id), testResourceId)
  })

  it('fetchOfferingEditRow returns null for nonexistent id', async () => {
    let row = await fetchOfferingEditRow(db, '-1')
    assert.equal(row, null)
  })

  it('updateOffering updates an existing offering', async () => {
    let id = await createOffering(db, {
      dayMs: offeringDate,
      resourceId: testResourceId,
      during: '[480,1080)',
    })
    let updated = await updateOffering(db, String(id), {
      dayMs: offeringDate,
      resourceId: testResourceId,
      during: '[540,1020)',
    })
    assert.equal(updated, true)

    let row = await fetchOfferingEditRow(db, String(id))
    assert.equal(row!.during, '[540,1020)')
  })

  it('updateOffering returns false for nonexistent id', async () => {
    let updated = await updateOffering(db, '-1', {
      dayMs: offeringDate,
      resourceId: testResourceId,
      during: '[480,1080)',
    })
    assert.equal(updated, false)
  })

  it('deleteOffering deletes an existing offering', async () => {
    let id = await createOffering(db, {
      dayMs: offeringDate,
      resourceId: testResourceId,
      during: '[480,1080)',
    })
    let deleted = await deleteOffering(db, String(id))
    assert.equal(deleted, true)

    let row = await fetchOfferingEditRow(db, String(id))
    assert.equal(row, null)
  })

  it('deleteOffering returns false for nonexistent id', async () => {
    let deleted = await deleteOffering(db, '-1')
    assert.equal(deleted, false)
  })

  it('listResources returns resource options', async () => {
    let rows = await listResources(db)
    assert.ok(rows.length >= 1)
    assert.ok(rows.some((r) => Number(r.id) === testResourceId))
  })

  it('listOfferings returns paginated offerings', async () => {
    await createOffering(db, {
      dayMs: offeringDate,
      resourceId: testResourceId,
      during: '[480,1080)',
    })

    let result = await listOfferings(db, {
      offset: 0,
      pageSize: 10,
      column: 'ao.id',
      direction: 'asc',
    })
    assert.ok(result.rows.length >= 1)
    assert.ok(result.rows.some((r) => r.resource_name))
  })

  it('listOfferings respects filter', async () => {
    let result = await listOfferings(db, {
      offset: 0,
      pageSize: 10,
      column: 'ao.id',
      direction: 'asc',
      filter: 'Raum',
    })
    assert.ok(result.rows.length >= 1)
  })

  it('listOfferings returns empty for nonexistent filter', async () => {
    let result = await listOfferings(db, {
      offset: 0,
      pageSize: 10,
      column: 'ao.id',
      direction: 'asc',
      filter: 'zzzzzzzzzzz',
    })
    assert.equal(result.rows.length, 0)
  })

  it('listResourceIdsWithConfigs returns resource ids that have configs', async () => {
    let ids = await listResourceIdsWithConfigs(db)
    assert.ok(Array.isArray(ids))
    assert.ok(ids.length >= 1)
    assert.ok(ids.includes(testResourceId))
  })

  it('deletePastOfferings deletes offerings before today', async () => {
    let pastDate = Date.now() - 365 * 86_400_000
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, $2, int4range(480, 1080, '[)'), $3, $3)`,
      [pastDate, testResourceId, Date.now()],
    )

    let deleted = await deletePastOfferings(db)
    assert.ok(typeof deleted === 'number')
    assert.ok(deleted >= 1)
  })
})
