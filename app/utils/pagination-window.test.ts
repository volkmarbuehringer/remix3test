import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { paginationWindow } from './pagination-window.ts'

describe('paginationWindow', () => {
  it('lists every page for short result sets', () => {
    assert.deepEqual(paginationWindow(1, 1), [1])
    assert.deepEqual(paginationWindow(3, 7), [1, 2, 3, 4, 5, 6, 7])
  })

  it('keeps first, last and neighbours with gaps in between', () => {
    assert.deepEqual(paginationWindow(1, 20), [1, 2, 'gap', 20])
    assert.deepEqual(paginationWindow(10, 20), [1, 'gap', 9, 10, 11, 'gap', 20])
    assert.deepEqual(paginationWindow(20, 20), [1, 'gap', 19, 20])
  })

  it('clamps a stale page to the window bounds', () => {
    // A delete can leave the URL on a page beyond the new last page; the nav
    // must still render a usable window instead of an out-of-range highlight.
    assert.deepEqual(paginationWindow(99, 3), [1, 2, 3])
  })
})
