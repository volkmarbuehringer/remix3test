import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { resolveDropZone, type RectLike, type SidebarRowRect } from './public/drop-zone.ts'

const editorRect: RectLike = { top: 0, bottom: 400, left: 240, right: 640 }
const sidebarRows: SidebarRowRect[] = [
  { listId: 11, rect: { top: 0, bottom: 32, left: 0, right: 200 } },
  { listId: 12, rect: { top: 32, bottom: 64, left: 0, right: 200 } },
]

describe('resolveDropZone', () => {
  it('returns editor zone for a point inside the editor container', () => {
    let result = resolveDropZone(400, 200, editorRect, sidebarRows)
    assert.deepEqual(result, { zone: 'editor' })
  })

  it('returns the matching sidebar listId for a point inside a sidebar row', () => {
    let result = resolveDropZone(100, 48, editorRect, sidebarRows)
    assert.deepEqual(result, { zone: 'sidebar', listId: 12 })
  })

  it('returns none for a point outside every zone', () => {
    let result = resolveDropZone(220, 500, editorRect, sidebarRows)
    assert.deepEqual(result, { zone: 'none' })
  })

  it('returns a single zone when rects overlap (mutual exclusion)', () => {
    // Point inside both the editor and a sidebar row → exactly one zone
    let overlap: SidebarRowRect[] = [
      { listId: 99, rect: { top: 100, bottom: 200, left: 300, right: 500 } },
    ]
    let result = resolveDropZone(400, 150, editorRect, overlap)
    assert.deepEqual(result, { zone: 'editor' })
  })

  it('returns none when there are no sidebar rows and the point is outside the editor', () => {
    let result = resolveDropZone(100, 100, editorRect, [])
    assert.deepEqual(result, { zone: 'none' })
  })

  it('returns none when the editor rect is null', () => {
    let result = resolveDropZone(500, 200, null, sidebarRows)
    assert.deepEqual(result, { zone: 'none' })
  })
})
