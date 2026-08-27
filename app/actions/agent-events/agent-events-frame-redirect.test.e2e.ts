import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { __setAgent } from './handlers/classify.ts'
import { __setRunFactory } from './controller.tsx'

// ---------------------------------------------------------------------------
// Agent-Events panel: activating/deactivating a user must stay in-frame.
//
// Reproduces the "agent dialog disappears" bug: the users grid is loaded into
// the nested agent-events-panel frame, the admin toggles a user (PRG 302), and
// the redirect was bailing to a top-level navigation (window.location.assign)
// that replaced the /admin/agent-events host page. The frameRedirects
// middleware (scoped to admin targets) now re-fetches the redirect as a GET
// fragment so the toggle stays in the panel.
//
// Requires: a running PostgreSQL database (global test setup) and a Playwright
// browser. The Mastra intent classifier and the workflow runtime are stubbed
// via __setAgent / __setRunFactory so the test is deterministic and does NOT
// need an LLM. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

const FAKE_CLASSIFY_TABLE: Record<string, string> = {
  'cancel user@newapp.com': '{"type":"user-action","action":"cancel","targetQuery":"user@newapp.com"}',
}

const FAKE_CLASSIFY_AGENT = {
  async generate(message: string) {
    return { text: FAKE_CLASSIFY_TABLE[message.trim()] ?? 'Could you clarify what you want to do?' }
  },
}

// Empty workflow stream: the pipeline emits `navigate` (the grid) before the run
// starts, so an empty stream is enough for the panel to switch to /admin/users.
const emptyWorkflowStream = (): AsyncIterable<unknown> =>
  (async function* () {
    /* intentional: no workflow events needed */
  })()

__setAgent(FAKE_CLASSIFY_AGENT)
__setRunFactory(async () => ({ runId: 'e2e-run', fullStream: emptyWorkflowStream() }))

const AGENT_EVENTS_PATH = routes.admin.agentEvents.index.href()

describe('admin agent-events panel: in-frame user toggle', () => {
  it('keeps the host agent page when toggling a user in the panel frame', async (t) => {
    // Admin session must be present on every request the panel makes.
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page.context().addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(AGENT_EVENTS_PATH)

    let input = page.locator('#agent-events-input')
    await input.waitFor({ timeout: 10_000 })
    // Send a command that resolves to the seeded non-admin user so the panel
    // navigates to the users grid (the trigger for the bug).
    await input.fill('cancel user@newapp.com')
    await page.locator('#agent-events-submit').click()

    // The SSE pipeline navigates the panel frame to /admin/users?filter=...;
    // wait for at least one per-row toggle form to render inside the frame.
    let toggleForm = page.locator('[data-toggle-form]').first()
    await toggleForm.waitFor({ timeout: 15_000 })

    // Activate/deactivate the user (PRG). With frameRedirects the redirect is
    // followed in-frame, so the host agent page must survive.
    await page.locator('[data-toggle-form] >> button[type="submit"]').first().click()

    // The host /admin/agent-events page is still mounted, not replaced.
    await page.locator('#agent-events-input').waitFor({ timeout: 10_000 })
    await page.locator('#ae-status-bar').waitFor()
    await page.locator('#agent-events-frame-container').waitFor()
    // The users grid is still rendered inside the panel frame (no top-level bail).
    await page.locator('[data-toggle-form]').first().waitFor({ timeout: 10_000 })

    // The document is the agent-events page (the frame stays put).
    assert.ok(
      await page.locator('#agent-events-frame-container').count() >= 1,
      'host agent-events frame container should still be present',
    )
  })
})
