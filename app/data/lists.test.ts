import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../db.ts'
import { lists } from '../data/schema.ts'
import {
  getListById,
  getListSummaries,
  getListSummariesByIds,
  createList,
  patchList,
  deleteList,
  moveItemBetweenLists,
  copyList,
} from './lists.ts'

describe('lists-api lib', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('createList creates a list and returns parsed row', async () => {
    let row = await createList(db, {
      description: 'Lib test list',
      items: [{ id: 'a', label: 'Test Item' }],
    })
    assert.ok(typeof row.id === 'number', 'should return numeric id')
    assert.equal(row.description, 'Lib test list')
    assert.equal(row.list.length, 1)
    assert.equal(row.list[0]!.label, 'Test Item')
    assert.ok(typeof row.created_at === 'number', 'created_at should be number')
    assert.ok(typeof row.updated_at === 'number', 'updated_at should be number')

    await db.delete(lists, { id: row.id })
  })

  it('createList assigns stable UUID to item without id', async () => {
    let row = await createList(db, {
      description: 'UUID test',
      items: [{ label: 'No id provided' }],
    })
    assert.equal(row.list.length, 1)
    assert.ok(typeof row.list[0]!.id === 'string', 'id should be a string')
    assert.ok(row.list[0]!.id.length > 0, 'id should not be empty')
    assert.ok(row.list[0]!.id !== 'undefined', 'id should not be literal undefined')

    await db.delete(lists, { id: row.id })
  })

  it('createList preserves client-supplied id', async () => {
    let row = await createList(db, {
      description: 'Preserve id',
      items: [{ id: 'my-custom-id', label: 'Known' }],
    })
    assert.equal(row.list.length, 1)
    assert.equal(row.list[0]!.id, 'my-custom-id')

    await db.delete(lists, { id: row.id })
  })

  it('getListById returns null for non-existent id', async () => {
    let row = await getListById(db, 999999999)
    assert.equal(row, null)
  })

  it('getListById returns parsed row for existing list', async () => {
    let created = await createList(db, {
      description: 'Get by ID test',
      items: [{ id: '1', label: 'Find Me' }],
    })
    let row = await getListById(db, created.id)
    assert.ok(row !== null)
    assert.equal(row!.description, 'Get by ID test')
    assert.equal(row!.list.length, 1)

    await db.delete(lists, { id: created.id })
  })

  it('patchList description-only updates description', async () => {
    let created = await createList(db, {
      description: 'Before patch',
      items: [{ id: '1', label: 'Item' }],
    })
    let result = await patchList(db, created.id, { description: 'After patch' }, undefined, {
      expectedUpdatedAt: created.updated_at,
    })
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.row.description, 'After patch')
      assert.equal(result.row.list.length, 1)
      assert.equal(result.row.list[0]!.label, 'Item')
      assert.ok(result.row.updated_at >= created.updated_at)
    }

    await db.delete(lists, { id: created.id })
  })

  it('patchList items-only updates items', async () => {
    let created = await createList(db, {
      description: 'Items only',
      items: [{ id: '1', label: 'Old' }],
    })
    let result = await patchList(
      db,
      created.id,
      { items: [{ id: '1', label: 'New' }, { label: 'Fresh' }] },
      undefined,
      {
        expectedUpdatedAt: created.updated_at,
      },
    )
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.row.description, 'Items only')
      assert.equal(result.row.list.length, 2)
      // existing item keeps its id
      assert.equal(result.row.list[0]!.id, '1')
      assert.equal(result.row.list[0]!.label, 'New')
      // new item got a UUID
      assert.ok(result.row.list[1]!.id.length > 0)
      assert.ok(result.row.list[1]!.id !== '1')
    }

    await db.delete(lists, { id: created.id })
  })

  it('patchList both fields updates both', async () => {
    let created = await createList(db, {
      description: 'Both before',
      items: [{ id: '1', label: 'A' }],
    })
    let result = await patchList(
      db,
      created.id,
      { description: 'Both after', items: [{ id: '1', label: 'B' }] },
      undefined,
      {
        expectedUpdatedAt: created.updated_at,
      },
    )
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.row.description, 'Both after')
      assert.equal(result.row.list[0]!.label, 'B')
    }

    await db.delete(lists, { id: created.id })
  })

  it('patchList preserves done flag through create->patch round-trip', async () => {
    let created = await createList(db, {
      description: 'Done round-trip',
      items: [
        { id: '1', label: 'Checked', done: true },
        { id: '2', label: 'Open' },
      ],
    })
    assert.equal(created.list[0]!.done, true)
    assert.equal(created.list[1]!.done, undefined)

    let result = await patchList(
      db,
      created.id,
      {
        items: [
          { id: '1', label: 'Checked', done: false },
          { id: '2', label: 'Open' },
        ],
      },
      undefined,
      {
        expectedUpdatedAt: created.updated_at,
      },
    )
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.row.list[0]!.done, false)
      assert.equal(result.row.list[1]!.done, undefined)
      assert.equal(result.row.list[0]!.id, '1', 'id preserved')
    }

    await db.delete(lists, { id: created.id })
  })

  it('item without done reads as unchecked (undefined)', async () => {
    let created = await createList(db, {
      description: 'No done flag',
      items: [{ label: 'Bare item' }],
    })
    assert.equal(created.list[0]!.done, undefined)
    assert.ok(!created.list[0]!.done, 'absent done must be falsy')

    await db.delete(lists, { id: created.id })
  })

  it('patchList returns not_found for non-existent id', async () => {
    let result = await patchList(db, 999999999, { description: 'Nope' })
    assert.ok(!result.ok)
    if (!result.ok) {
      assert.equal(result.reason, 'not_found')
    }
  })

  it('patchList returns conflict on mismatched updated_at', async () => {
    let created = await createList(db, {
      description: 'Conflict test',
      items: [{ id: '1', label: 'Original' }],
    })
    // Use a deliberately stale updated_at
    let result = await patchList(db, created.id, { description: 'Should not apply' }, undefined, {
      expectedUpdatedAt: created.updated_at - 9999,
    })
    assert.ok(!result.ok)
    if (!result.ok) {
      assert.equal(result.reason, 'conflict')
      assert.ok(result.current !== undefined)
      assert.equal(result.current.description, 'Conflict test')
    }

    await db.delete(lists, { id: created.id })
  })

  it('patchList force-overwrite after conflict succeeds', async () => {
    let created = await createList(db, {
      description: 'Force test',
      items: [{ id: '1', label: 'First' }],
    })
    // First patch changes the row
    let first = await patchList(db, created.id, { description: 'Stepped' }, undefined, {
      expectedUpdatedAt: created.updated_at,
    })
    assert.ok(first.ok)
    if (!first.ok) return

    // Second patch with old updated_at — conflict
    let conflict = await patchList(db, created.id, { description: 'Should conflict' }, undefined, {
      expectedUpdatedAt: created.updated_at,
    })
    assert.ok(!conflict.ok)
    if (!conflict.ok && conflict.reason === 'conflict') {
      // Retry with the current updated_at from conflict response — force overwrite
      let retry = await patchList(db, created.id, { description: 'Force saved' }, undefined, {
        expectedUpdatedAt: conflict.current.updated_at,
      })
      assert.ok(retry.ok)
      if (retry.ok) {
        assert.equal(retry.row.description, 'Force saved')
      }
    }

    await db.delete(lists, { id: created.id })
  })

  it('patchList scopes by userId', async () => {
    let ownerId = 1
    let created = await createList(
      db,
      {
        description: 'Owned by user 1',
        items: [{ id: '1', label: 'Mine' }],
      },
      ownerId,
    )
    // Try to patch as wrong user
    let result = await patchList(db, created.id, { description: 'Hack attempt' }, 999, {
      expectedUpdatedAt: created.updated_at,
    })
    assert.ok(!result.ok)
    if (!result.ok) {
      assert.equal(result.reason, 'not_found')
    }

    await db.delete(lists, { id: created.id })
  })

  it('deleteList returns false for non-existent id', async () => {
    let result = await deleteList(db, 999999999)
    assert.equal(result, false)
  })

  it('deleteList deletes an existing list', async () => {
    let created = await createList(db, {
      description: 'Delete me',
      items: [{ id: '1', label: 'Gone' }],
    })
    let deleted = await deleteList(db, created.id)
    assert.equal(deleted, true)

    let row = await getListById(db, created.id)
    assert.equal(row, null)
  })

  it('moveItemBetweenLists moves an item and bumps both updated_at', async () => {
    let source = await createList(db, {
      description: 'Move source',
      items: [
        { id: 's1', label: 'Alpha' },
        { id: 's2', label: 'Beta' },
      ],
    })
    let target = await createList(db, {
      description: 'Move target',
      items: [{ id: 't1', label: 'Existing' }],
    })

    let result = await moveItemBetweenLists(db, source.id, target.id, 's1', undefined, {
      expectedUpdatedAt: source.updated_at,
    })
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.source.list.length, 1)
      assert.equal(result.source.list[0]!.id, 's2')
      assert.equal(result.target.list.length, 2)
      assert.equal(result.target.list[0]!.id, 't1')
      assert.equal(result.target.list[1]!.id, 's1', 'moved item appended at end')
      assert.ok(result.source.updated_at >= source.updated_at)
      assert.ok(result.target.updated_at >= target.updated_at)
      assert.equal(result.target.list[1]!.label, 'Alpha', 'item data preserved')
    }

    await db.delete(lists, { id: source.id })
    await db.delete(lists, { id: target.id })
  })

  it('moveItemBetweenLists rejects moving the last item', async () => {
    let source = await createList(db, {
      description: 'Lonely source',
      items: [{ id: 'solo', label: 'Only' }],
    })
    let target = await createList(db, {
      description: 'Any target',
      items: [{ id: 't1', label: 'Keep' }],
    })

    let result = await moveItemBetweenLists(db, source.id, target.id, 'solo', undefined, {
      expectedUpdatedAt: source.updated_at,
    })
    assert.ok(!result.ok)
    if (!result.ok) assert.equal(result.reason, 'last_item')

    let after = await getListById(db, source.id)
    assert.equal(after!.list.length, 1, 'source unchanged')

    await db.delete(lists, { id: source.id })
    await db.delete(lists, { id: target.id })
  })

  it('moveItemBetweenLists rejects moving into the same list', async () => {
    let source = await createList(db, {
      description: 'Same list',
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    })

    let result = await moveItemBetweenLists(db, source.id, source.id, 'a', undefined, {
      expectedUpdatedAt: source.updated_at,
    })
    assert.ok(!result.ok)
    if (!result.ok) assert.equal(result.reason, 'same_list')

    await db.delete(lists, { id: source.id })
  })

  it('moveItemBetweenLists returns conflict on stale source updated_at', async () => {
    let source = await createList(db, {
      description: 'Stale source',
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    })
    let target = await createList(db, {
      description: 'Stale target',
      items: [{ id: 't1', label: 'Keep' }],
    })

    let result = await moveItemBetweenLists(db, source.id, target.id, 'a', undefined, {
      expectedUpdatedAt: source.updated_at - 9999,
    })
    assert.ok(!result.ok)
    if (!result.ok) {
      assert.equal(result.reason, 'conflict')
      assert.equal(result.current.description, 'Stale source')
      assert.equal(result.current.list.length, 2, 'source not modified')
    }

    await db.delete(lists, { id: source.id })
    await db.delete(lists, { id: target.id })
  })

  it('moveItemBetweenLists preserves done flag on the moved item', async () => {
    let source = await createList(db, {
      description: 'Done move source',
      items: [
        { id: 'd1', label: 'Checked', done: true },
        { id: 'd2', label: 'Open' },
      ],
    })
    let target = await createList(db, {
      description: 'Done move target',
      items: [{ id: 't1', label: 'Existing' }],
    })

    let result = await moveItemBetweenLists(db, source.id, target.id, 'd1', undefined, {
      expectedUpdatedAt: source.updated_at,
    })
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.target.list[1]!.id, 'd1')
      assert.equal(result.target.list[1]!.done, true, 'moved item keeps done=true')
      assert.equal(result.source.list.length, 1)
      assert.equal(result.source.list[0]!.done, undefined, 'remaining item keeps done absent')
    }

    await db.delete(lists, { id: source.id })
    await db.delete(lists, { id: target.id })
  })

  it('moveItemBetweenLists removes only the matched duplicate id', async () => {
    let source = await createList(db, {
      description: 'Duplicate source',
      items: [
        { id: 'dup', label: 'Copy A' },
        { id: 'dup', label: 'Copy B' },
        { id: 'ok', label: 'Keep' },
      ],
    })
    let target = await createList(db, {
      description: 'Duplicate target',
      items: [{ id: 't1', label: 'Existing' }],
    })

    let result = await moveItemBetweenLists(db, source.id, target.id, 'dup', undefined, {
      expectedUpdatedAt: source.updated_at,
    })
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.target.list[1]!.label, 'Copy A', 'exactly one duplicate moved')
      assert.equal(result.source.list.length, 2, 'one duplicate stays in source')
      assert.equal(
        result.source.list.filter((i) => i.id === 'dup').length,
        1,
        'one duplicate id remains in source',
      )
    }

    await db.delete(lists, { id: source.id })
    await db.delete(lists, { id: target.id })
  })

  it('moveItemBetweenLists returns not_found for a deleted target', async () => {
    let source = await createList(db, {
      description: 'Gone target source',
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    })
    let target = await createList(db, {
      description: 'Doomed target',
      items: [{ id: 't1', label: 'Keep' }],
    })
    await deleteList(db, target.id)

    let result = await moveItemBetweenLists(db, source.id, target.id, 'a', undefined, {
      expectedUpdatedAt: source.updated_at,
    })
    assert.ok(!result.ok)
    if (!result.ok) assert.equal(result.reason, 'not_found')

    await db.delete(lists, { id: source.id })
  })

  it('moveItemBetweenLists returns not_found for foreign-owner source', async () => {
    let source = await createList(
      db,
      {
        description: 'Owned by user 1',
        items: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      },
      1,
    )
    let target = await createList(
      db,
      { description: 'Owned by user 1 too', items: [{ id: 't1', label: 'Keep' }] },
      1,
    )

    let result = await moveItemBetweenLists(db, source.id, target.id, 'a', 999, {
      expectedUpdatedAt: source.updated_at,
    })
    assert.ok(!result.ok)
    if (!result.ok) assert.equal(result.reason, 'not_found')

    await db.delete(lists, { id: source.id })
    await db.delete(lists, { id: target.id })
  })

  // -----------------------------------------------------------------------
  // Title field
  // -----------------------------------------------------------------------

  it('createList stores and returns a title', async () => {
    let row = await createList(db, {
      title: 'Meine Einkaufsliste',
      description: 'Wöchentlicher Einkauf',
      items: [{ id: 'a', label: 'Milch' }],
    })
    assert.equal(row.title, 'Meine Einkaufsliste')
    assert.equal(row.description, 'Wöchentlicher Einkauf')
    assert.equal(row.list.length, 1)

    await db.delete(lists, { id: row.id })
  })

  it('createList defaults title to empty string when omitted', async () => {
    let row = await createList(db, {
      description: 'No title given',
      items: [{ id: 'a', label: 'Item' }],
    })
    assert.equal(row.title, '')

    await db.delete(lists, { id: row.id })
  })

  it('getListById returns the title', async () => {
    let created = await createList(db, {
      title: 'Title via get',
      description: 'Ignored',
      items: [{ id: 'a', label: 'Item' }],
    })
    let row = await getListById(db, created.id)
    assert.ok(row !== null)
    assert.equal(row!.title, 'Title via get')

    await db.delete(lists, { id: created.id })
  })

  it('patchList updates title independently', async () => {
    let created = await createList(db, {
      title: 'Before',
      description: 'Desc',
      items: [{ id: '1', label: 'Item' }],
    })
    let result = await patchList(db, created.id, { title: 'After' }, undefined, {
      expectedUpdatedAt: created.updated_at,
    })
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.row.title, 'After')
      assert.equal(result.row.description, 'Desc')
    }

    await db.delete(lists, { id: created.id })
  })

  it('patchList leaves an absent title untouched', async () => {
    let created = await createList(db, {
      title: 'Keep me',
      description: 'Desc',
      items: [{ id: '1', label: 'Item' }],
    })
    let result = await patchList(db, created.id, { description: 'New desc' }, undefined, {
      expectedUpdatedAt: created.updated_at,
    })
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.row.title, 'Keep me')
      assert.equal(result.row.description, 'New desc')
    }

    await db.delete(lists, { id: created.id })
  })

  it('patchList clears a title to empty', async () => {
    let created = await createList(db, {
      title: 'Clear me',
      description: 'Desc',
      items: [{ id: '1', label: 'Item' }],
    })
    let result = await patchList(db, created.id, { title: '' }, undefined, {
      expectedUpdatedAt: created.updated_at,
    })
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.row.title, '')
      assert.equal(result.row.description, 'Desc', 'description should be preserved')
    }

    await db.delete(lists, { id: created.id })
  })

  it('patchList trims a whitespace-only title to empty', async () => {
    let created = await createList(db, {
      title: 'Trim me',
      description: 'Desc',
      items: [{ id: '1', label: 'Item' }],
    })
    let result = await patchList(db, created.id, { title: '   ' }, undefined, {
      expectedUpdatedAt: created.updated_at,
    })
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.row.title, '', 'whitespace-only title should be trimmed to empty')
    }

    await db.delete(lists, { id: created.id })
  })

  // ── Lean sidebar summaries ──────────────────────────────────────────────

  it('getListSummaries computes item_count and done_count in SQL', async () => {
    let created = await createList(db, {
      description: 'Summary counts',
      items: [
        { id: '1', label: 'Done A', done: true },
        { id: '2', label: 'Open B' },
        { id: '3', label: 'Done C', done: true },
      ],
    })
    let empty = await createList(db, { description: 'Empty list', items: [] })

    let result = await getListSummaries(db, { limit: 100, offset: 0 })
    let summary = result.data.find((s) => s.id === created.id)
    assert.ok(summary, 'should include the created list')
    if (summary) {
      assert.equal(summary.count, 3, 'count should be item_count')
      assert.equal(summary.doneCount, 2, 'doneCount should be count of done items')
      assert.equal(summary.description, 'Summary counts')
      assert.ok(typeof summary.updated_at === 'number', 'updated_at should be a number')
    }
    let emptySummary = result.data.find((s) => s.id === empty.id)
    assert.ok(emptySummary, 'should include the empty list')
    if (emptySummary) {
      assert.equal(emptySummary.count, 0)
      assert.equal(emptySummary.doneCount, 0)
    }

    await db.delete(lists, { id: created.id })
    await db.delete(lists, { id: empty.id })
  })

  it('getListSummaries matches an item label via the filter', async () => {
    let created = await createList(db, {
      description: 'Filter by label',
      items: [
        { id: '1', label: 'Needle Item' },
        { id: '2', label: 'Needle Again' },
      ],
    })

    let result = await getListSummaries(db, { limit: 100, offset: 0, filter: 'Needle' })
    assert.ok(
      result.data.some((s) => s.id === created.id),
      'filter should match a list whose items contain the term',
    )

    await db.delete(lists, { id: created.id })
  })

  it('getListSummariesByIds preserves id order, scopes by owner, drops missing ids', async () => {
    let a = await createList(db, { description: 'Order A', items: [{ id: '1', label: 'a' }] })
    let b = await createList(db, {
      description: 'Order B',
      items: [
        { id: '1', label: 'b', done: true },
        { id: '2', label: 'b2' },
      ],
    })

    // Request out of order; result must follow the requested id order.
    let rows = await getListSummariesByIds(db, [b.id, a.id, 9_999_999])
    assert.equal(rows.length, 2, 'missing ids should be dropped')
    assert.equal(rows[0]!.id, b.id, 'first requested id should come first')
    assert.equal(rows[1]!.id, a.id)
    let bRow = rows.find((r) => r.id === b.id)
    assert.ok(bRow)
    if (bRow) {
      assert.equal(bRow.count, 2, 'B should have two items')
      assert.equal(bRow.doneCount, 1, 'B should have one done item')
    }

    // Owner scoping: a non-admin user sees only their own lists.
    let scoped = await getListSummariesByIds(db, [b.id, a.id], 999_999_999)
    assert.equal(scoped.length, 0, 'other-user lists should be omitted')

    await db.delete(lists, { id: a.id })
    await db.delete(lists, { id: b.id })
  })

  // -----------------------------------------------------------------------
  // Per-item metadata
  // -----------------------------------------------------------------------

  it('createList preserves per-item metadata (priority, due, tags, updatedAt)', async () => {
    let row = await createList(db, {
      description: 'Metadata round-trip',
      items: [
        {
          id: '1',
          label: 'Urgent',
          priority: 'high',
          due: '2025-12-31',
          tags: ['work', 'soon'],
          updatedAt: 123,
        },
        { id: '2', label: 'Plain' },
        { id: '3', label: 'Low', priority: 'low' },
      ],
    })
    assert.equal(row.list.length, 3)
    assert.equal(row.list[0]!.priority, 'high')
    assert.equal(row.list[0]!.due, '2025-12-31')
    assert.deepEqual(row.list[0]!.tags, ['work', 'soon'])
    assert.equal(row.list[0]!.updatedAt, 123)
    assert.equal(row.list[1]!.priority, undefined)
    assert.equal(row.list[1]!.due, undefined)
    assert.equal(row.list[2]!.priority, 'low')

    // Round-trip through a fresh read keeps the metadata intact.
    let fetched = await getListById(db, row.id)
    assert.ok(fetched)
    if (fetched) {
      assert.equal(fetched.list[0]!.priority, 'high')
      assert.equal(fetched.list[0]!.due, '2025-12-31')
      assert.deepEqual(fetched.list[0]!.tags, ['work', 'soon'])
      assert.equal(fetched.list[0]!.updatedAt, 123)
    }

    await db.delete(lists, { id: row.id })
  })

  it('createList drops empty metadata (empty tags array / blank due)', async () => {
    let row = await createList(db, {
      description: 'Empty metadata',
      items: [{ id: '1', label: 'A', due: '', tags: [] }],
    })
    assert.equal(row.list[0]!.due, undefined, 'blank due should be dropped')
    assert.equal(row.list[0]!.tags, undefined, 'empty tags should be dropped')

    await db.delete(lists, { id: row.id })
  })

  it('patchList updates and clears per-item metadata', async () => {
    let created = await createList(db, {
      description: 'Patch metadata',
      items: [{ id: '1', label: 'A' }],
    })
    let set = await patchList(
      db,
      created.id,
      { items: [{ id: '1', label: 'A', priority: 'medium', due: '2026-01-01', tags: ['x'] }] },
      undefined,
      { expectedUpdatedAt: created.updated_at },
    )
    assert.ok(set.ok)
    if (set.ok) {
      assert.equal(set.row.list[0]!.priority, 'medium')
      assert.equal(set.row.list[0]!.due, '2026-01-01')
      assert.deepEqual(set.row.list[0]!.tags, ['x'])
    }

    // Clearing metadata: sending a blank label-only item drops the fields.
    let cleared = await patchList(db, created.id, { items: [{ id: '1', label: 'A' }] }, undefined, {
      expectedUpdatedAt: set.ok ? set.row.updated_at : created.updated_at,
    })
    assert.ok(cleared.ok)
    if (cleared.ok) {
      assert.equal(cleared.row.list[0]!.priority, undefined)
      assert.equal(cleared.row.list[0]!.due, undefined)
      assert.equal(cleared.row.list[0]!.tags, undefined)
    }

    await db.delete(lists, { id: created.id })
  })

  // -----------------------------------------------------------------------
  // Duplicate / copy list
  // -----------------------------------------------------------------------

  it('copyList duplicates a list with fresh item ids and a title suffix', async () => {
    let source = await createList(db, {
      title: 'Einkauf',
      description: 'Wöchentlich',
      items: [
        { id: 'a', label: 'Milch', priority: 'high', due: '2025-12-31', done: true },
        { id: 'b', label: 'Brot' },
      ],
    })

    let copy = await copyList(db, source.id)
    assert.ok(copy, 'copy should succeed')
    assert.ok(copy)
    if (copy) {
      assert.ok(copy.id !== source.id, 'copy is a new row')
      assert.equal(copy.title, 'Einkauf (Kopie)')
      assert.equal(copy.description, 'Wöchentlich')
      assert.equal(copy.list.length, 2)
      assert.notEqual(copy.list[0]!.id, 'a', 'copied item gets a fresh id')
      assert.notEqual(copy.list[1]!.id, 'b', 'second copied item gets a fresh id')
      assert.equal(copy.list[0]!.label, 'Milch')
      assert.equal(copy.list[0]!.priority, 'high', 'metadata is copied')
      assert.equal(copy.list[0]!.due, '2025-12-31')
      assert.equal(copy.list[0]!.done, true)
      assert.equal(copy.list[1]!.label, 'Brot')
    }

    // The source is unchanged.
    let unchanged = await getListById(db, source.id)
    assert.equal(unchanged!.list.length, 2)
    assert.equal(unchanged!.list.find((i) => i.id === 'a')!.label, 'Milch')

    await db.delete(lists, { id: source.id })
    if (copy) await db.delete(lists, { id: copy.id })
  })

  it('copyList returns null for a non-existent list', async () => {
    let copy = await copyList(db, 999_999_999)
    assert.equal(copy, null)
  })

  it('copyList is scoped by owner', async () => {
    let source = await createList(
      db,
      { description: 'Owned by 1', items: [{ id: 'a', label: 'A' }] },
      1,
    )
    let copy = await copyList(db, source.id, 999)
    assert.equal(copy, null, 'foreign-owner copy should be rejected')

    await db.delete(lists, { id: source.id })
  })

  it('copyList applies the owner to the copied row', async () => {
    let source = await createList(
      db,
      { description: 'Owned by 1', items: [{ id: 'a', label: 'A' }] },
      1,
    )
    let copy = await copyList(db, source.id, 1)
    assert.ok(copy)
    if (copy) {
      assert.equal(copy.user_id, 1)
      await db.delete(lists, { id: copy.id })
    }
    await db.delete(lists, { id: source.id })
  })
})
