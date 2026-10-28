import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from '../db.ts'
import { pool } from '../../test/pool.ts'
import { countLists, listsSearchPattern, searchLists } from './admin-lists.ts'

async function seedUserId(email: string): Promise<number> {
  let result = await pool.query('SELECT id FROM users WHERE email = $1', [email])
  let id = result.rows[0]?.id
  assert.ok(id !== undefined, `seed user ${email} must exist`)
  return Number(id)
}

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
    let timestamp = Date.now()
    await pool.query(
      `INSERT INTO lists (description, list, created_at, updated_at)
       VALUES ('test-admin-empty-status', '[]'::jsonb, $1, $1),
              ('test-admin-items-status', $2::jsonb, $1, $1)`,
      [timestamp, JSON.stringify([{ id: '1', label: 'Buy milk' }])],
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
    let timestamp = Date.now()
    await pool.query(
      `INSERT INTO lists (description, list, created_at, updated_at)
       VALUES ('test-admin-combo-empty', '[]'::jsonb, $1, $1),
              ('test-admin-combo-items', $2::jsonb, $1, $1)`,
      [timestamp, JSON.stringify([{ id: '1', label: 'Combo Widget' }])],
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

  it('searchLists returns the owner email and null for unowned rows', async () => {
    let timestamp = Date.now()
    let ownerId = await seedUserId('user@newapp.com')
    await pool.query(
      `INSERT INTO lists (user_id, description, list, created_at, updated_at)
       VALUES ($1, 'test-admin-owned-row', '[]'::jsonb, $2, $2),
              (NULL, 'test-admin-unowned-row', '[]'::jsonb, $2, $2)`,
      [ownerId, timestamp],
    )

    let owned = await searchLists(db, '%test-admin-owned-row%', 10, 0)
    assert.equal(owned[0]?.owner_email, 'user@newapp.com', 'owned row should carry its owner')

    let unowned = await searchLists(db, '%test-admin-unowned-row%', 10, 0)
    assert.equal(unowned[0]?.owner_email, null, 'unowned row should have no owner email')
  })

  it('searchLists matches lists by the owner email', async () => {
    let timestamp = Date.now()
    let ownerId = await seedUserId('user@newapp.com')
    await pool.query(
      `INSERT INTO lists (user_id, description, list, created_at, updated_at)
       VALUES ($1, 'test-admin-owner-email-search', '[]'::jsonb, $2, $2)`,
      [ownerId, timestamp],
    )

    let rows = await searchLists(db, '%user@newapp.com%', 50, 0)
    assert.ok(
      rows.some((row) => row.description === 'test-admin-owner-email-search'),
      'searching an owner email should find that owner’s lists',
    )
  })

  it('searchLists matches lists by the owner name', async () => {
    let timestamp = Date.now()
    let ownerId = await seedUserId('user@newapp.com')
    await pool.query(
      `INSERT INTO lists (user_id, description, list, created_at, updated_at)
       VALUES ($1, 'test-admin-owner-name-search', '[]'::jsonb, $2, $2)`,
      [ownerId, timestamp],
    )

    let rows = await searchLists(db, '%John Doe%', 50, 0)
    assert.ok(
      rows.some((row) => row.description === 'test-admin-owner-name-search'),
      'searching an owner name should find that owner’s lists',
    )
  })

  it('searchLists orders by owner email', async () => {
    let timestamp = Date.now()
    let adminId = await seedUserId('admin@newapp.com')
    let userId = await seedUserId('user@newapp.com')
    await pool.query(
      `INSERT INTO lists (user_id, description, list, created_at, updated_at)
       VALUES ($1, 'test-admin-owner-sort-b', '[]'::jsonb, $2, $2),
              ($3, 'test-admin-owner-sort-a', '[]'::jsonb, $2, $2)`,
      [userId, timestamp, adminId],
    )

    let rows = await searchLists(db, '%test-admin-owner-sort%', 50, 0, 'owner', 'asc')
    assert.deepEqual(
      rows.map((row) => row.description),
      ['test-admin-owner-sort-a', 'test-admin-owner-sort-b'],
      'owner sort should order admin@ before user@',
    )
  })

  it('searchLists tolerates malformed list payloads instead of failing the grid', async () => {
    let timestamp = Date.now()
    await pool.query(
      `INSERT INTO lists (description, list, created_at, updated_at)
       VALUES ('test-admin-poison-object', '{"nope":true}'::jsonb, $1, $1),
              ('test-admin-poison-item', '[{"label":1}, "junk"]'::jsonb, $1, $1)`,
      [timestamp],
    )

    let rows = await searchLists(db, '%test-admin-poison%', 10, 0, 'description', 'asc')
    assert.deepEqual(
      rows.map((row) => row.list),
      [[{ id: '', label: '' }], []],
      'malformed items keep only string fields, and a non-array payload becomes []',
    )
  })

  it('item filters and item-count sort tolerate malformed payloads', async () => {
    let timestamp = Date.now()
    await pool.query(
      `INSERT INTO lists (description, list, created_at, updated_at)
       VALUES ('test-admin-malformed-object', '{"nope":true}'::jsonb, $1, $1),
              ('test-admin-malformed-array', '[{"id":"a","label":"Widget"}]'::jsonb, $1, $1)`,
      [timestamp],
    )

    let empty = await searchLists(db, '%test-admin-malformed%', 10, 0, 'items', 'desc', 'empty')
    assert.equal(empty.length, 1, 'an object payload should count as empty, not throw')
    assert.equal(empty[0]?.description, 'test-admin-malformed-object')

    let withItems = await searchLists(db, '%test-admin-malformed%', 10, 0, 'items', 'desc', 'items')
    assert.equal(withItems.length, 1, 'only the array payload should have items')
    assert.equal(withItems[0]?.description, 'test-admin-malformed-array')
    assert.equal(await countLists(db, '%test-admin-malformed%', 'empty'), 1)

    // A label search reaches the EXISTS array scan for the object row too.
    let labelMatches = await searchLists(db, '%Widget%', 50, 0)
    assert.ok(
      labelMatches.some((row) => row.description === 'test-admin-malformed-array'),
      'label search should still find the well-formed array row',
    )
  })

  it('searchLists sorts unowned rows last when ordering by owner', async () => {
    let timestamp = Date.now()
    let adminId = await seedUserId('admin@newapp.com')
    await pool.query(
      `INSERT INTO lists (user_id, description, list, created_at, updated_at)
       VALUES ($1, 'test-admin-owner-nullsort-owned', '[]'::jsonb, $2, $2),
              (NULL, 'test-admin-owner-nullsort-unowned', '[]'::jsonb, $2, $2)`,
      [adminId, timestamp],
    )

    for (let direction of ['asc', 'desc'] as const) {
      let rows = await searchLists(db, '%test-admin-owner-nullsort%', 50, 0, 'owner', direction)
      assert.equal(
        rows[rows.length - 1]?.description,
        'test-admin-owner-nullsort-unowned',
        `unowned rows should sort last in ${direction} order`,
      )
    }
  })

  it('countLists matches the same rows and item filter as searchLists', async () => {
    let token = 'test-admin-count-data-' + Date.now()
    let timestamp = Date.now()
    await pool.query(
      `INSERT INTO lists (description, list, created_at, updated_at)
       VALUES ($1, '[]'::jsonb, $3, $3),
              ($2, $4::jsonb, $3, $3)`,
      [
        token + '-empty',
        token + '-filled',
        timestamp,
        JSON.stringify([{ id: '1', label: 'Widget' }]),
      ],
    )

    let pattern = listsSearchPattern(token)
    assert.equal(await countLists(db, pattern), 2, 'count should mirror the unfiltered search')
    assert.equal(await countLists(db, pattern, 'empty'), 1, 'empty filter should count one row')
    assert.equal(await countLists(db, pattern, 'items'), 1, 'items filter should count one row')
    assert.equal(
      await countLists(db, listsSearchPattern('zzzznotfoundzzzz')),
      0,
      'a non-matching search should count zero',
    )
  })

  it('listsSearchPattern escapes LIKE wildcards and clamps the filter', () => {
    assert.equal(listsSearchPattern('50%_off'), '%50\\%\\_off%')
    assert.equal(listsSearchPattern(''), '%%')
    assert.equal(listsSearchPattern(undefined), '%%')
    assert.equal(listsSearchPattern('x'.repeat(250)), '%' + 'x'.repeat(200) + '%')
  })
})
