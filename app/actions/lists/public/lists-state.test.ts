import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  addItem,
  buildVisibleItems,
  clearDoneItems,
  countItemsByStatus,
  cloneItems,
  createItem,
  deleteItemAt,
  dueBadge,
  editItemFields,
  filterItems,
  filterItemsByStatus,
  isOverdueItem,
  itemsFingerprint,
  orderViewItems,
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

  it('filterItems also matches tags (case-insensitive substring)', () => {
    let tagged: ListItem[] = [
      item('t1', 'Milch kaufen', { tags: ['Einkauf', 'Kühlware'] }),
      item('t2', 'Bohrer', { tags: ['Werkstatt'] }),
      item('t3', 'Zitrone', { tags: ['Kühlware'] }),
      item('t4', 'Ohne Tag'),
    ]
    assert.deepEqual(
      filterItems(tagged, 'einkauf').map((i) => i.id),
      ['t1'],
    )
    assert.deepEqual(
      filterItems(tagged, 'KÜHL').map((i) => i.id),
      ['t1', 't3'],
    )
    // The label match still works for an item that has no tags.
    assert.deepEqual(
      filterItems(tagged, 'zitr').map((i) => i.id),
      ['t3'],
    )
  })

  it('sortItems by due puts dated items first (ascending) and undated items last in order', () => {
    let dated: ListItem[] = [
      item('a', 'Ohne Termin'),
      item('c', 'Mitte', { due: '2026-10-15' }),
      item('b', 'Früh', { due: '2026-10-10' }),
      item('d', 'Spät', { due: '2026-10-20' }),
      item('e', 'Auch ohne Termin'),
    ]
    assert.deepEqual(
      sortItems(dated, 'due').map((i) => i.id),
      ['b', 'c', 'd', 'a', 'e'],
    )
  })

  it('counts status tabs with overdue only for open items', () => {
    // Fixed local "today" so the test never depends on the machine clock.
    let now = new Date(2026, 9, 14, 9, 0, 0).getTime()
    let statusSample: ListItem[] = [
      item('a', 'Überfällig', { due: '2026-10-13' }),
      item('b', 'Heute fällig', { due: '2026-10-14' }),
      item('c', 'Zukunft', { due: '2026-10-15' }),
      item('d', 'Ohne Termin'),
      item('e', 'Erledigt, war überfällig', { done: true, due: '2026-10-01' }),
    ]

    assert.deepEqual(countItemsByStatus(statusSample, now), {
      all: 5,
      open: 4,
      done: 1,
      overdue: 1,
    })
    assert.equal(isOverdueItem(statusSample[0]!, '2026-10-14'), true)
    assert.equal(isOverdueItem(statusSample[1]!, '2026-10-14'), false)
    assert.equal(isOverdueItem(statusSample[4]!, '2026-10-14'), false)
    assert.equal(isOverdueItem(item('x', 'Malformed', { due: 'bald' }), '2026-10-14'), false)
  })

  it('filters by status and optionally hides done items on the all tab', () => {
    let now = new Date(2026, 9, 14, 9, 0, 0).getTime()
    let statusSample: ListItem[] = [
      item('a', 'Überfällig', { due: '2026-10-13' }),
      item('b', 'Heute fällig', { due: '2026-10-14' }),
      item('c', 'Zukunft', { due: '2026-10-15' }),
      item('d', 'Ohne Termin'),
      item('e', 'Erledigt', { done: true }),
    ]

    let ids = (rows: ListItem[]) => rows.map((row) => row.id)
    assert.deepEqual(ids(filterItemsByStatus(statusSample, 'all', false, now)), [
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
    assert.deepEqual(ids(filterItemsByStatus(statusSample, 'all', true, now)), ['a', 'b', 'c', 'd'])
    assert.deepEqual(ids(filterItemsByStatus(statusSample, 'open', false, now)), [
      'a',
      'b',
      'c',
      'd',
    ])
    assert.deepEqual(ids(filterItemsByStatus(statusSample, 'done', false, now)), ['e'])
    assert.deepEqual(ids(filterItemsByStatus(statusSample, 'done', true, now)), ['e'])
    assert.deepEqual(ids(filterItemsByStatus(statusSample, 'overdue', false, now)), ['a'])
  })

  it('buildVisibleItems combines text, status, and view-only ordering without mutating items', () => {
    let now = new Date(2026, 9, 14, 9, 0, 0).getTime()
    let combined: ListItem[] = [
      item('a', 'Banane', { done: true }),
      item('b', 'Ananas'),
      item('c', 'Apfel'),
    ]
    let before = JSON.stringify(combined)

    assert.deepEqual(
      buildVisibleItems(combined, { query: 'an', status: 'open', sort: 'az' }, now).map(
        (i) => i.id,
      ),
      ['b'],
    )
    assert.deepEqual(
      buildVisibleItems(combined, { query: '', status: 'all', sort: 'az' }, now).map((i) => i.id),
      ['b', 'c', 'a'],
    )
    assert.deepEqual(
      buildVisibleItems(combined, { status: 'all', reverse: true }, now).map((i) => i.id),
      ['c', 'b', 'a'],
    )
    assert.deepEqual(
      buildVisibleItems(combined, { status: 'all', shuffleOrder: ['a', 'c', 'b'] }, now).map(
        (i) => i.id,
      ),
      ['a', 'c', 'b'],
    )
    assert.equal(JSON.stringify(combined), before, 'the persisted array must stay untouched')
  })

  it('orderViewItems keeps unknown ids at the end of a shuffle order', () => {
    let ordered = orderViewItems(sample, 'manual', { shuffleOrder: ['c', 'a'] })
    assert.deepEqual(
      ordered.map((i) => i.id),
      ['c', 'a', 'b'],
    )
    assert.deepEqual(
      orderViewItems(sample, 'manual', { shuffleOrder: ['c', 'a'], reverse: true }).map(
        (i) => i.id,
      ),
      ['b', 'a', 'c'],
    )
  })

  it('dueBadge humanizes today/tomorrow, flags overdue, and shows short dates otherwise', () => {
    // Fixed "now": Wednesday, 2026-10-14 local midnight + some hours.
    let now = new Date(2026, 9, 14, 9, 0, 0).getTime()
    assert.deepEqual(dueBadge('2026-10-14', false, now), { text: 'heute', overdue: false })
    assert.deepEqual(dueBadge('2026-10-15', false, now), { text: 'morgen', overdue: false })
    assert.deepEqual(dueBadge('2026-10-13', false, now), { text: 'überfällig', overdue: true })
    assert.deepEqual(dueBadge('2026-10-18', false, now), { text: '18.10.', overdue: false })
    // Done items never scream "überfällig" — the date just shows quietly.
    assert.deepEqual(dueBadge('2026-10-13', true, now), { text: '13.10.', overdue: false })
    // Other years carry the year so the day/month alone stays unambiguous.
    assert.deepEqual(dueBadge('2027-01-03', false, now), { text: '03.01.2027', overdue: false })
    assert.deepEqual(dueBadge('2025-12-24', true, now), { text: '24.12.2025', overdue: false })
  })
})
