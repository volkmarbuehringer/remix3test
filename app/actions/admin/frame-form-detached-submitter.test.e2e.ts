import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser, isFirefox } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'

// ---------------------------------------------------------------------------
// Frame form navigation when the submit button is detached before `navigate`.
//
// Regression guard for remix #11987 ("resolve form navigation when submitter is
// detached before navigate fires"). Custom-element libraries submit through a
// temporary native button and remove it before the Navigation API's `navigate`
// event fires. Before #11987 the frame runtime resolved the form from
// `sourceElement.form`, which is `null` for a detached button, so the submission
// was not recognised and fell back to a full document navigation.
//
// This must be an e2e: only the real client runtime (`app/assets/entry.tsx` ->
// `run()`) installs the document `submit` + `window.navigation` listeners. The
// `render()` component-test harness passes `frameInit` but never starts the
// navigation listener, so a *.test.browser.tsx cannot exercise this path.
//
// The webhook-requests viewer has a plain GET filter form targeting the
// `admin-content` frame, so counting document `load` events cleanly tells an
// in-frame reload (no new load) from a full-page navigation (one new load).
//
// Firefox: #11987 does not reach it on this build (48b54a55). The fix populates
// the submitter index from the native `formdata` snapshot, but its guard
// (`event.eventPhase !== Event.NONE`) rejects Firefox, which fires `formdata`
// while the `submit` event is still at AT_TARGET (phase 2) — so the detached
// submitter still full-navigates. The strict assertion is therefore scoped to
// Chromium (same shape as agent-events-frame-redirect.test.e2e.ts); Firefox
// keeps a smoke check that the submission completes.
// ---------------------------------------------------------------------------

const FORM = 'form[data-rmx-target="admin-content"]'
const FILTER = `${FORM} input[name="filter"]`

function hydrated() {
  let indicator = document.querySelector('[aria-label^="SSE connection:"]')
  return (
    indicator != null && indicator.getAttribute('aria-label') !== 'SSE connection: Connecting...'
  )
}

describe('frame form navigation with a detached submitter', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('reloads the target frame for an ordinary GET form submit', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    let loads = 0
    page.on('load', () => {
      loads++
    })

    await page.goto(routes.admin.webhookRequests.index.href())
    await page.locator(FILTER).waitFor({ timeout: 15_000 })
    await page.waitForFunction(hydrated, undefined, { timeout: 15_000 })

    let marker = `attached-${Date.now()}`
    await page.locator(FILTER).fill(marker)
    await page.locator(`${FORM} button[type="submit"]`).click()

    await page.waitForFunction(
      (expected) => new URLSearchParams(location.search).get('filter') === expected,
      marker,
      { timeout: 15_000 },
    )
    assert.equal(loads, 1, 'a normal form submit must reload the frame, not the document')
  })

  it('reloads the target frame when the submit button is removed before navigate fires', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    let loads = 0
    page.on('load', () => {
      loads++
    })

    await page.goto(routes.admin.webhookRequests.index.href())
    await page.locator(FILTER).waitFor({ timeout: 15_000 })
    await page.waitForFunction(hydrated, undefined, { timeout: 15_000 })

    let marker = `detached-${Date.now()}`
    await page.locator(FILTER).fill(marker)

    // Submit through a temporary native button and remove it synchronously. The
    // document capture listener is registered after the runtime's, so the runtime
    // has already recorded the submitter when the button detaches.
    await page.evaluate(() => {
      let form = document.querySelector<HTMLFormElement>('form[data-rmx-target="admin-content"]')
      if (!form) throw new Error('the webhook filter form must render')
      let button = document.createElement('button')
      button.type = 'submit'
      button.hidden = true
      form.append(button)
      document.addEventListener('submit', () => button.remove(), { capture: true, once: true })
      button.click()
    })

    // The GET form updates the frame URL and the frame re-renders with the
    // submitted filter. The document-navigation fallback changes the URL too, so
    // the `load` count below is what proves the frame path was taken.
    await page.waitForFunction(
      (expected) => new URLSearchParams(location.search).get('filter') === expected,
      marker,
      { timeout: 15_000 },
    )
    await page.waitForFunction(
      (expected) =>
        document.querySelector<HTMLInputElement>(
          'form[data-rmx-target="admin-content"] input[name="filter"]',
        )?.value === expected,
      marker,
      { timeout: 15_000 },
    )

    if (isFirefox(page)) {
      // Known Firefox gap in #11987 (see header): the detached submitter falls
      // back to a document navigation, so only assert the submission completed.
      return
    }

    assert.equal(loads, 1, 'the detached submitter must reload the frame, not the document')
  })
})
