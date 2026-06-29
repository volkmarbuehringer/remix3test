import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { db, pool, initializeAppDatabase } from '../data/setup.ts'
import { lists } from '../data/schema.ts'
import { getListById, createList, updateList, deleteList } from './lists-api.ts'

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

    // Cleanup
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

    // Cleanup
    await db.delete(lists, { id: created.id })
  })

  it('updateList returns false for non-existent id', async () => {
    let result = await updateList(db, 999999999, {
      description: 'Nope',
      items: [],
    })
    assert.equal(result, false)
  })

  it('updateList updates an existing list', async () => {
    let created = await createList(db, {
      description: 'Before update',
      items: [{ id: '1', label: 'Old' }],
    })
    let updated = await updateList(db, created.id, {
      description: 'After update',
      items: [{ id: '1', label: 'New' }],
    })
    assert.equal(updated, true)

    let row = await getListById(db, created.id)
    assert.equal(row!.description, 'After update')
    assert.equal(row!.list[0].label, 'New')

    // Cleanup
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
