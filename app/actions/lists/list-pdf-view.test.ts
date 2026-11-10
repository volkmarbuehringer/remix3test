import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { listPdfViewLabel, parseListPdfView, selectListPdfItems } from './list-pdf-view.ts'
import type { ListItem } from './public/lists-state.ts'

// Fixed local "today" (2026-10-14) so the overdue tab never depends on the clock.
const NOW = new Date(2026, 9, 14, 9, 0, 0).getTime()

const ITEMS: ListItem[] = [
  { id: 'a', label: 'Apfel', due: '2026-10-13' },
  { id: 'b', label: 'Banane', done: true },
  { id: 'c', label: 'Cranberry', due: '2026-10-20', tags: ['obst'] },
]

function ids(search: string): string[] {
  return selectListPdfItems(ITEMS, parseListPdfView(new URLSearchParams(search)), NOW).map(
    (item) => item.id,
  )
}

describe('list PDF view', () => {
  it('parses view params and falls back to defaults for unknown values', () => {
    assert.deepEqual(parseListPdfView(new URLSearchParams('')), {
      query: '',
      status: 'all',
      hideDone: false,
      sort: 'manual',
      reverse: false,
    })

    assert.deepEqual(
      parseListPdfView(new URLSearchParams('q=obst+rot&status=open&hideDone=1&sort=az&reverse=1')),
      { query: 'obst rot', status: 'open', hideDone: true, sort: 'az', reverse: true },
    )

    assert.deepEqual(
      parseListPdfView(new URLSearchParams('status=bogus&sort=bogus&q=' + 'x'.repeat(250))),
      {
        query: 'x'.repeat(200),
        status: 'all',
        hideDone: false,
        sort: 'manual',
        reverse: false,
      },
    )
  })

  it('describes only the non-default controls', () => {
    assert.equal(listPdfViewLabel(parseListPdfView(new URLSearchParams(''))), undefined)

    assert.equal(
      listPdfViewLabel(
        parseListPdfView(new URLSearchParams('status=open&sort=due&reverse=1&q=an')),
      ),
      'Ansicht: Status Offen · Nach Fälligkeit · umgekehrt · Suche „an“',
    )

    assert.equal(
      listPdfViewLabel(parseListPdfView(new URLSearchParams('hideDone=1'))),
      'Ansicht: Erledigte ausgeblendet',
    )

    // The done tab already excludes open rows, so hide-done adds no information.
    assert.equal(
      listPdfViewLabel(parseListPdfView(new URLSearchParams('status=done&hideDone=1'))),
      'Ansicht: Status Erledigt',
    )
  })

  it('selects the same rows the editor shows', () => {
    assert.deepEqual(ids(''), ['a', 'b', 'c'])
    assert.deepEqual(ids('status=open'), ['a', 'c'])
    assert.deepEqual(ids('status=done'), ['b'])
    assert.deepEqual(ids('status=overdue'), ['a'])
    assert.deepEqual(ids('hideDone=1'), ['a', 'c'])
    assert.deepEqual(ids('q=obst'), ['c'])
    assert.deepEqual(ids('q=obst&status=open&sort=az'), ['c'])
    assert.deepEqual(ids('sort=az'), ['a', 'b', 'c'])
    assert.deepEqual(ids('sort=az&reverse=1'), ['c', 'b', 'a'])
    assert.deepEqual(ids('sort=due'), ['a', 'c', 'b'])
  })
})
