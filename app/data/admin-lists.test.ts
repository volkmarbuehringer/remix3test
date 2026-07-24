import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from './setup.ts'
import { pool } from './test-pool.ts'
import { searchLists } from './admin-lists.ts'

describe('admin-lists', () => {
  let now: number

  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM lists WHERE description LIKE 'test-admin-%'")
  })

  it('searchLists returns rows matching the search pattern', async () => {
    now = Date.now()
    await pool.query(
      `INSERT INTO lists (description, list, created_at, updated_at)
       VALUES ('test-admin-urgent-items', $1::jsonb, $2, $2)`,
      [JSON.stringify([{ id: '1', label: 'Buy milk' }]), now],
    )
    let rows = await searchLists(db, '%urgent%', 10, 0)
    assert.ok(rows.length >= 1)
    assert.ok(
      rows[0].description === 'test-admin-urgent-items' ||
        rows.some((r) => r.description === 'test-admin-urgent-items'),
    )
  })

  it('searchLists matches against item labels in JSONB list', async () => {
    now = Date.now()
    await pool.query(
      `INSERT INTO lists (description, list, created_at, updated_at)
       VALUES ('test-admin-label-search', $1::jsonb, $2, $2)`,
      [JSON.stringify([{ id: 'a', label: 'Special Widget' }]), now],
    )
    let rows = await searchLists(db, '%widget%', 10, 0)
    assert.ok(rows.length >= 1)
  })

  it('searchLists returns empty array when no match', async () => {
    let rows = await searchLists(db, '%zzzznotfoundzzzz%', 10, 0)
    assert.ok(Array.isArray(rows))
    assert.equal(rows.length, 0)
  })
})
