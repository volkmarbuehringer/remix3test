import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  addItem,
  clearDoneItems,
  cloneItems,
  createItem,
  deleteItemAt,
  editItemFields,
  filterItems,
  itemsFingerprint,
  parseItemsFingerprint,
  removeItemsByIds,
  reverseItems,
  shuffleItems,
  sortItems,
  toggleAllVisible,
  toggleDoneAt,
  toggleSelected,
} from './lists-state.ts'
import type { ListItem } from './lists-state.ts'

function item(id: string, label: string, rest: Partial<ListItem> = {}): ListItem {
  return { id, label, ...rest }
}

const sample: ListItem[] = [
  item('a', 'Banane', { done: true, updatedAt: 3 }),
  item('b', 'Apfel', { updatedAt: 1 }),
  item('c', 'Clementine', { updatedAt: 2 }),
]

describe('lists-state', () => {
  it('cloneItems copies the array and each row without sharing rows', () => {
    let copy = cloneItems(sample)
    assert.notEqual(copy, sample)
    assert.notEqual(copy[0], sample[0])
    assert.deepEqual(copy, sample)
  })

  it('createItem trims the label and stamps the time', () => {
    assert.deepEqual(createItem('  Milch  ', 'x1', 42), { id: 'x1', label: 'Milch', updatedAt: 42 })
  })

  it('addItem / deleteItemAt keep stable ids and ignore a bad index', () => {
    let added = addItem(sample, item('d', 'Dattel'))
    assert.equal(added.length, 4)
    assert.deepEqual(
      added.map((i) => i.id),
      ['a', 'b', 'c', 'd'],
    )
    assert.deepEqual(
      deleteItemAt(added, 1).map((i) => i.id),
      ['a', 'c', 'd'],
    )
    assert.equal(deleteItemAt(sample, 99), sample)
  })

  it('toggleDoneAt flips only the target row and bumps its updatedAt', () => {
    let next = toggleDoneAt(sample, 1, 99)
    assert.equal(next[1]!.done, true)
    assert.equal(next[1]!.updatedAt, 99)
    assert.equal(next[0]!.done, true)
    assert.equal(next[2]!.done, undefined)
    // Toggling back clears it.
    assert.equal(toggleDoneAt(next, 1, 100)[1]!.done, false)
  })

  it('reverseItems returns a reversed copy', () => {
    let next = reverseItems(sample)
    assert.deepEqual(
      next.map((i) => i.id),
      ['c', 'b', 'a'],
    )
    assert.deepEqual(
      sample.map((i) => i.id),
      ['a', 'b', 'c'],
    )
  })

  it('shuffleItems is deterministic given a rand source', () => {
    let next = shuffleItems(sample, () => 0)
    assert.deepEqual(
      next.map((i) => i.id),
      ['b', 'c', 'a'],
    )
  })

  it('sortItems sorts by label, done, and updatedAt; manual is a no-op copy', () => {
    assert.deepEqual(
      sortItems(sample, 'az').map((i) => i.label),
      ['Apfel', 'Banane', 'Clementine'],
    )
    assert.deepEqual(
      sortItems(sample, 'done').map((i) => i.id),
      ['b', 'c', 'a'],
    )
    assert.deepEqual(
      sortItems(sample, 'updated').map((i) => i.id),
      ['a', 'c', 'b'],
    )
    let manual = sortItems(sample, 'manual')
    assert.notEqual(manual, sample)
    assert.deepEqual(manual, sample)
  })

  it('clearDoneItems returns the survivors and the removed ids', () => {
    let result = clearDoneItems(sample)
    assert.deepEqual(
      result.items.map((i) => i.id),
      ['b', 'c'],
    )
    assert.deepEqual(result.removedIds, ['a'])
  })

  it('removeItemsByIds splits removed rows from survivors', () => {
    let result = removeItemsByIds(sample, new Set(['a', 'c']))
    assert.deepEqual(
      result.items.map((i) => i.id),
      ['b'],
    )
    assert.deepEqual(
      result.removed.map((i) => i.id),
      ['a', 'c'],
    )
  })

  it('toggleSelected adds then removes, without mutating the input set', () => {
    let start = new Set(['a'])
    let added = toggleSelected(start, 'b')
    assert.deepEqual([...added].toSorted(), ['a', 'b'])
    assert.deepEqual([...start], ['a'])
    assert.deepEqual([...toggleSelected(added, 'a')], ['b'])
  })

  it('toggleAllVisible selects all or clears all visible ids', () => {
    let cleared = toggleAllVisible(new Set(['a', 'b']), ['a', 'b'])
    assert.equal(cleared.size, 0)
    let selected = toggleAllVisible(new Set(['a']), ['a', 'b'])
    assert.deepEqual([...selected].toSorted(), ['a', 'b'])
    // Empty visible list must not "select all" (guards the all-visible predicate).
    assert.equal(toggleAllVisible(new Set(['a']), []).size, 1)
  })

  it('editItemFields trims, dedupes tags, and drops empty optional fields', () => {
    let next = editItemFields(
      item('a', 'Alt', { priority: 'low', due: '2026-01-01', tags: ['x'] }),
      { label: '  Neu  ', priority: 'high', due: '  ', tags: ' rot, blau , rot ' },
      7,
    )
    assert.equal(next.label, 'Neu')
    assert.equal(next.priority, 'high')
    assert.equal(next.due, undefined)
    assert.deepEqual(next.tags, ['rot', 'blau'])
    assert.equal(next.updatedAt, 7)
  })

  it('itemsFingerprint / parseItemsFingerprint round-trip', () => {
    assert.deepEqual(parseItemsFingerprint(itemsFingerprint(sample)), sample)
  })

  it('filterItems matches case-insensitively and returns the input when empty', () => {
    assert.deepEqual(
      filterItems(sample, 'ap').map((i) => i.id),
      ['b'],
    )
    assert.deepEqual(
      filterItems(sample, 'AN').map((i) => i.id),
      ['a'],
    )
    assert.equal(filterItems(sample, '   '), sample)
  })
})
