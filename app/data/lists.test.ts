import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../data/setup.ts'
import { lists } from '../data/schema.ts'
import { getListById, createList, patchList, deleteList } from './lists.ts'

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
    assert.equal(row.list[0].label, 'Test Item')
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
    assert.ok(typeof row.list[0].id === 'string', 'id should be a string')
    assert.ok(row.list[0].id.length > 0, 'id should not be empty')
    assert.ok(row.list[0].id !== 'undefined', 'id should not be literal undefined')

    await db.delete(lists, { id: row.id })
  })

  it('createList preserves client-supplied id', async () => {
    let row = await createList(db, {
      description: 'Preserve id',
      items: [{ id: 'my-custom-id', label: 'Known' }],
    })
    assert.equal(row.list.length, 1)
    assert.equal(row.list[0].id, 'my-custom-id')

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
      assert.equal(result.row.list[0].label, 'Item')
      assert.ok(result.row.updated_at >= created.updated_at)
    }

    await db.delete(lists, { id: created.id })
  })

  it('patchList items-only updates items', async () => {
    let created = await createList(db, {
      description: 'Items only',
      items: [{ id: '1', label: 'Old' }],
    })
    let result = await patchList(db, created.id, { items: [{ id: '1', label: 'New' }, { label: 'Fresh' }] }, undefined, {
      expectedUpdatedAt: created.updated_at,
    })
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.row.description, 'Items only')
      assert.equal(result.row.list.length, 2)
      // existing item keeps its id
      assert.equal(result.row.list[0].id, '1')
      assert.equal(result.row.list[0].label, 'New')
      // new item got a UUID
      assert.ok(result.row.list[1].id.length > 0)
      assert.ok(result.row.list[1].id !== '1')
    }

    await db.delete(lists, { id: created.id })
  })

  it('patchList both fields updates both', async () => {
    let created = await createList(db, {
      description: 'Both before',
      items: [{ id: '1', label: 'A' }],
    })
    let result = await patchList(db, created.id, { description: 'Both after', items: [{ id: '1', label: 'B' }] }, undefined, {
      expectedUpdatedAt: created.updated_at,
    })
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.row.description, 'Both after')
      assert.equal(result.row.list[0].label, 'B')
    }

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
    let created = await createList(db, {
      description: 'Owned by user 1',
      items: [{ id: '1', label: 'Mine' }],
    }, ownerId)
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
})
