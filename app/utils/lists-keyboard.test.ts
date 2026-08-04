import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  moveItemInArray,
  findTypeaheadTarget,
  nextFocusIndex,
  type KeyboardListItem,
} from './lists-keyboard.ts'

const sample: KeyboardListItem[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
]

const ids = (items: KeyboardListItem[]) => items.map((i) => i.id)

describe('moveItemInArray', () => {
  // 4.1 grab -> move -> drop reorders and preserves ids
  it('moves the last item to the first position', () => {
    let result = moveItemInArray(sample, 2, 0)
    assert.deepEqual(ids(result), ['c', 'a', 'b'])
  })

  it('moves an item down one position', () => {
    let result = moveItemInArray(sample, 0, 1)
    assert.deepEqual(ids(result), ['b', 'a', 'c'])
  })

  // 4.2 quick-move up; no-op at the top
  it('is a no-op when from === to', () => {
    let result = moveItemInArray(sample, 1, 1)
    assert.equal(result, sample)
  })

  it('is a no-op when target is out of bounds', () => {
    assert.equal(moveItemInArray(sample, 0, -1), sample)
    assert.equal(moveItemInArray(sample, 0, 3), sample)
  })

  it('returns the same reference for out-of-range from', () => {
    assert.equal(moveItemInArray(sample, 9, 0), sample)
  })
})

describe('findTypeaheadTarget', () => {
  // 4.3 typeahead jumps to a matching label
  it('jumps forward to the first label starting with the char', () => {
    let items = [
      { label: 'Banana' },
      { label: 'Apple' },
      { label: 'Apricot' },
    ]
    assert.equal(findTypeaheadTarget(items, 0, 'a'), 1)
  })

  it('wraps to the start when nothing matches after the current index', () => {
    let items = [{ label: 'Banana' }, { label: 'Apple' }, { label: 'Cherry' }]
    assert.equal(findTypeaheadTarget(items, 1, 'b'), 0)
  })

  it('returns -1 when no label matches', () => {
    let items = [{ label: 'Apple' }, { label: 'Banana' }]
    assert.equal(findTypeaheadTarget(items, 0, 'z'), -1)
  })
})

describe('nextFocusIndex (sidebar / list roving focus)', () => {
  // 4.4 arrow navigation moves focus, clamped; Home/End jump
  it('moves focus down and clamps at the end', () => {
    assert.equal(nextFocusIndex(3, 0, 'ArrowDown'), 1)
    assert.equal(nextFocusIndex(3, 2, 'ArrowDown'), 2)
  })

  it('moves focus up and clamps at the start', () => {
    assert.equal(nextFocusIndex(3, 2, 'ArrowUp'), 1)
    assert.equal(nextFocusIndex(3, 0, 'ArrowUp'), 0)
  })

  it('Home and End jump to first and last', () => {
    assert.equal(nextFocusIndex(4, 2, 'Home'), 0)
    assert.equal(nextFocusIndex(4, 1, 'End'), 3)
  })

  it('returns -1 for an empty list', () => {
    assert.equal(nextFocusIndex(0, 0, 'ArrowDown'), -1)
  })
})
