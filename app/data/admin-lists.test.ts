import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from '../db.ts'
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
      rows[0]!.description === 'test-admin-urgent-items' ||
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

  it('searchLists filters by item-count status', async () => {
    let now = Date.now()
    await pool.query(
      `INSERT INTO lists (description, list, created_at, updated_at)
       VALUES ('test-admin-empty-status', '[]'::jsonb, $1, $1),
              ('test-admin-items-status', $2::jsonb, $1, $1)`,
      [now, JSON.stringify([{ id: '1', label: 'Buy milk' }])],
    )

    let empty = await searchLists(db, '%%', 50, 0, undefined, undefined, 'empty')
    assert.ok(
      empty.some((row) => row.description === 'test-admin-empty-status'),
      'empty filter should include an empty list',
    )
    assert.ok(
      !empty.some((row) => row.description === 'test-admin-items-status'),
      'empty filter should exclude a list with items',
    )

    let withItems = await searchLists(db, '%%', 50, 0, undefined, undefined, 'items')
    assert.ok(
      withItems.some((row) => row.description === 'test-admin-items-status'),
      'items filter should include a non-empty list',
    )
    assert.ok(
      !withItems.some((row) => row.description === 'test-admin-empty-status'),
      'items filter should exclude an empty list',
    )
  })

  it('searchLists combines a text search with the item-count status', async () => {
    let now = Date.now()
    await pool.query(
      `INSERT INTO lists (description, list, created_at, updated_at)
       VALUES ('test-admin-combo-empty', '[]'::jsonb, $1, $1),
              ('test-admin-combo-items', $2::jsonb, $1, $1)`,
      [now, JSON.stringify([{ id: '1', label: 'Combo Widget' }])],
    )

    let rows = await searchLists(db, '%combo%', 50, 0, undefined, undefined, 'items')
    assert.ok(
      rows.some((row) => row.description === 'test-admin-combo-items'),
      'combined search + items filter should match the non-empty row',
    )
    assert.ok(
      !rows.some((row) => row.description === 'test-admin-combo-empty'),
      'combined search + items filter should drop the empty row',
    )
  })
})
