import { describe, it, beforeEach } from 'remix/test'
import * as assert from 'remix/assert'

import {
  ensureSelectionScope,
  isSelected,
  selectIds,
  deselectIds,
  selectedIds,
  selectedCount,
  clearSelection,
} from './upload-selection.ts'

// The module holds a single Set at module scope, so every test starts from a
// cleared selection.
beforeEach(() => {
  clearSelection()
})

describe('upload-selection', () => {
  it('selects ids without duplicates and reports membership and count', () => {
    selectIds([1, 2, 2, 3])

    assert.equal(selectedCount(), 3)
    assert.ok(isSelected(2))
    assert.deepEqual(
      [...selectedIds()].sort((a, b) => a - b),
      [1, 2, 3],
    )
  })

  it('deselects ids and ignores ones that were never selected', () => {
    selectIds([1, 2, 3])

    deselectIds([2, 99])

    assert.equal(selectedCount(), 2)
    assert.equal(isSelected(2), false)
    assert.ok(isSelected(1))
  })

  it('clears every selected id', () => {
    selectIds([4, 5])

    clearSelection()

    assert.equal(selectedCount(), 0)
    assert.deepEqual(selectedIds(), [])
  })

  it('starts a fresh selection when the scope key changes', () => {
    ensureSelectionScope('filter:none')
    selectIds([1, 2])
    assert.equal(selectedCount(), 2)

    ensureSelectionScope('filter:pdf')

    assert.equal(selectedCount(), 0)
    assert.equal(isSelected(1), false)
  })

  it('keeps the selection for the same scope key', () => {
    ensureSelectionScope('filter:keep')
    selectIds([7])

    ensureSelectionScope('filter:keep')

    assert.equal(selectedCount(), 1)
    assert.ok(isSelected(7))
  })
})
