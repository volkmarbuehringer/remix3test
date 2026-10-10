import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'

import { ListsSearch } from './lists-search.tsx'

// SSR regression guard. During SSR `handle.frame` is a real EventTarget while
// `handle.signal` is a frozen, AbortSignal-shaped stub. Node duck-types the stub,
// but Bun brand-checks the `signal` option and throws `Type error` — so an
// unguarded frame listener passes under `test:server` and fails under `test:bun`.
// This renders the entry directly so the failure is specific to ListsSearch
// rather than buried in the full route-suite run.
describe('ListsSearch SSR', () => {
  it('server-renders without registering frame listeners', async () => {
    let html = await renderToString(<ListsSearch />)
    assert.ok(html.length > 0, 'server-rendered html is not empty')
  })
})
