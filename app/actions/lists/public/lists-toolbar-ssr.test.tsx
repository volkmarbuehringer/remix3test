import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'

import { ListsClient } from './lists-client.tsx'
import type { ListInitialState } from './lists-state.ts'

// #12152: boolean aria-*/data-* values must serialize as "true"/"false" during
// SSR, not as an empty value or a missing attribute. Before the fix the
// reverse/help controls only exposed their closed state after hydration, so a
// server-rendered toolbar had no accessible state at all.

const initialState: ListInitialState = {
  id: 7,
  title: 'SSR toolbar',
  description: '',
  items: [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
  ],
  updated_at: 111,
}

function buttonTag(html: string, marker: string): string {
  let match = new RegExp(`<button[^>]*${marker}[^>]*>`).exec(html)
  assert.ok(match, `expected a button carrying ${marker}`)
  return match[0]
}

describe('lists toolbar SSR', () => {
  it('renders aria-pressed="false" and aria-expanded="false"', async () => {
    let html = await renderToString(<ListsClient initialState={initialState} />)

    let reverse = buttonTag(html, 'data-reverse-toggle')
    assert.ok(
      reverse.includes('aria-pressed="false"'),
      `closed reverse toggle must render aria-pressed="false": ${reverse}`,
    )

    let help = buttonTag(html, 'data-help-button')
    assert.ok(
      help.includes('aria-expanded="false"'),
      `closed help trigger must render aria-expanded="false": ${help}`,
    )

    let allTab = buttonTag(html, 'data-status-filter="all"')
    assert.ok(
      allTab.includes('aria-pressed="true"'),
      `the selected status tab must render aria-pressed="true": ${allTab}`,
    )
  })
})
