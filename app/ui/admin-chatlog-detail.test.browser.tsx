import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { AdminChatlogDetail } from './admin-chatlog-detail.browser.tsx'

// ---------------------------------------------------------------------------
// Chatlog master–detail pane (browser suite).
//
// The pane's close control keeps a real href for the no-JS path, so the client
// handler must cancel that navigation: otherwise the runtime refetches the
// list and steals the focus the collapse just restored. This test drives the
// delegated close handler against a fixture that mirrors the server markup and
// asserts the in-place dismiss + focus return.
//
// The server render (header placement, accessible name) is asserted in
// app/actions/admin/admin-chatlog-fragments.test.ts. The module-scoped OPEN_KEY
// is internal; the literal below mirrors it.
// ---------------------------------------------------------------------------

const OPEN_KEY = 'admin-chatlog-detail-open'
const THREAD_ID = 'thread-1'

const DETAIL_HTML = `
  <div data-chatlog-detail="true" data-chatlog-missing="false">
    <div>
      <div>
        <h3>Hallo</h3>
        <a
          href="/admin/chatlog?offset=0"
          data-chatlog-close="true"
          data-chatlog-return="${THREAD_ID}"
          aria-label="Konversation schließen"
          title="Schließen"
        >×</a>
      </div>
      <div><span>1 Nachricht</span></div>
    </div>
    <div>Transkript</div>
  </div>
`

let fixture: HTMLElement | null = null
let cleanups: Array<() => void> = []

function mountOpenPane() {
  let host = document.createElement('div')
  host.innerHTML = `
    <div data-chatlog-page="true">
      <div data-chatlog-master-detail="true" data-chatlog-detail-open="false">
        <table><tbody><tr data-chatlog-row="${THREAD_ID}">
          <td><a data-chatlog-open="${THREAD_ID}" href="/admin/chatlog/fragments/detail/${THREAD_ID}">Hallo</a></td>
        </tr></tbody></table>
        <div data-chatlog-detail-panel="true" data-chatlog-detail-open="false" tabindex="-1">${DETAIL_HTML}</div>
      </div>
    </div>
    <div id="chatlog-entry"></div>
  `
  document.body.appendChild(host)
  fixture = host

  // The entry restores the remembered thread into the pane on setup.
  sessionStorage.setItem(OPEN_KEY, THREAD_ID)
  let mountPoint = host.querySelector<HTMLElement>('#chatlog-entry') as HTMLElement
  cleanups.push(render(<AdminChatlogDetail />, { container: mountPoint }).cleanup)

  return {
    row: host.querySelector<HTMLAnchorElement>(
      `a[data-chatlog-open="${THREAD_ID}"]`,
    ) as HTMLAnchorElement,
    close: host.querySelector<HTMLAnchorElement>('[data-chatlog-close]') as HTMLAnchorElement,
    panel: host.querySelector<HTMLElement>('[data-chatlog-detail-panel]') as HTMLElement,
  }
}

afterEach(() => {
  for (let cleanup of cleanups) cleanup()
  cleanups = []
  fixture?.remove()
  fixture = null
  sessionStorage.removeItem(OPEN_KEY)
  for (let style of document.head.querySelectorAll('style[data-rmx-style]')) style.remove()
})

describe('Admin chatlog detail pane', () => {
  it('dismisses in place, cancels the fallback navigation, and restores row focus', () => {
    let { row, close, panel } = mountOpenPane()

    assert.equal(panel.getAttribute('data-chatlog-detail-open'), 'true')

    // A later document listener sees whether the entry cancelled the click
    // before the browser would follow the no-JS href.
    let preventedByEntry: boolean | null = null
    let guard = (event: MouseEvent) => {
      preventedByEntry = event.defaultPrevented
      if (!event.defaultPrevented) event.preventDefault()
    }
    document.addEventListener('click', guard, { once: true })

    let event = new MouseEvent('click', { bubbles: true, cancelable: true })
    let notCancelled = close.dispatchEvent(event)
    document.removeEventListener('click', guard)

    assert.equal(notCancelled, false, 'the fallback href must not navigate')
    assert.equal(preventedByEntry, true, 'the entry must cancel the fallback navigation')
    assert.equal(panel.getAttribute('data-chatlog-detail-open'), 'false')
    assert.equal(document.activeElement, row, 'focus returns to the conversation row')
    assert.equal(sessionStorage.getItem(OPEN_KEY), null)
  })
})
