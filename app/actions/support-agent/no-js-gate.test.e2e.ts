import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import type { Page, Response } from 'playwright'

import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes, frames } from '../../routes.ts'
import type { AgentStreamOutput, TestAgent } from '../mastra/shared-agent.ts'

import {
  __setTestAgent as __setCustomerTestAgent,
  __setTestResumeResolver,
  chatRateLimiter as customerChatRateLimiter,
} from '../chat/controller.tsx'
import { recordChatRun } from '../chat/run-store.ts'
import { markGateSuspended as markCustomerGateSuspended } from '../chat/gate-store.ts'

import {
  __setTestAgent as __setSupportTestAgent,
  chatRateLimiter as supportChatRateLimiter,
} from './controller.tsx'
import {
  upsertPendingGate as upsertSupportGate,
  markGateSuspended as markSupportGateSuspended,
} from './run-store.ts'

// ---------------------------------------------------------------------------
// No-JS gate flow.
//
// GET /chat server-renders a suspended approval gate as a real
// <form method="post">, so a browser without JavaScript submits it natively,
// the action drains its internal SSE resume, and the reply is a 303 back to the
// page whose server-rendered flash proves the round trip. The first test drives
// that with the browser's JavaScript actually disabled.
//
// The admin /admin/support-agent gate is the same native form, but the admin
// shell delivers its page content through a *non-blocking* self-relay frame
// (app/ui/frame-shell.tsx): the full document carries the fallback plus a
// <template> with the real content, and only the client runtime swaps the
// template in. A JS-disabled browser therefore never reaches the form (it sees
// "Inhalt wird geladen…"), so the second test proves the same no-JS*transport*
// over HTTP: the frame fragment renders the form, a form-encoded POST without
// the X-Sse-Request header answers 303, and the follow-up GET renders the
// flash. Making the admin gate reachable from a JS-disabled browser would
// require making the shell's self-relay frame blocking — a structural change
// tracked separately, not a gate bug.
// ---------------------------------------------------------------------------

function createMockStreamOutput(text: string): AgentStreamOutput {
  return {
    runId: crypto.randomUUID(),
    fullStream: new ReadableStream({
      start(controller) {
        if (text) controller.enqueue({ type: 'text-delta', textDelta: text })
        controller.enqueue({ type: 'finish', payload: {} })
        controller.close()
      },
    }),
    getFullOutput: async () => ({ text, finishReason: 'stop' }),
  }
}

/** The agent surface both gates resume through; neither turn streams. */
function makeMockAgent(): TestAgent {
  return {
    generate: async () => ({ text: '' }),
    stream: async () => createMockStreamOutput(''),
    resumeStream: async () => createMockStreamOutput(''),
    approveToolCallGenerate: async () => ({ finishReason: 'stop', text: '' }),
    declineToolCallGenerate: async () => ({ finishReason: 'stop', text: '' }),
  }
}

async function createUser(role: 'admin' | 'customer'): Promise<{ id: number; cookie: string }> {
  let email = `nojs-${role}-${Date.now()}-${Math.random()}@example.com`
  let result = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at)
     VALUES ($1, $2, 'NoJs', $3, 1, 1, $4) RETURNING id`,
    [email, 'hashed-password-for-testing', role, Date.now()],
  )
  let id = result.rows[0]!.id as number
  let session = await createAuthCookieWithCsrfForUser(email)
  assert.ok(session?.cookie, 'authenticated session must be created')
  return { id, cookie: session!.cookie }
}

type NoJsServeContext = {
  serve(server: { baseUrl: string; close(): Promise<void> }): Promise<Page>
  after(fn: () => void): void
}

/**
 * Wires the test server to a Playwright page whose context has JavaScript
 * disabled, with the session cookie installed. The served page exists only to
 * reach the shared browser and to register the server teardown.
 */
async function openNoJsPage(
  t: NoJsServeContext,
  server: { baseUrl: string; close(): Promise<void> },
  cookie: string,
): Promise<Page> {
  let servedPage = await t.serve(server)
  let browser = servedPage.context().browser()
  assert.ok(browser, 'the served page must be backed by a Playwright browser')
  let context = await browser!.newContext({
    javaScriptEnabled: false,
    baseURL: server.baseUrl,
  })
  // Await the close (and swallow a double-close race): an unhandled rejection
  // here would crash the whole e2e worker before the results are reported.
  t.after(async () => {
    await context.close().catch(() => {})
  })
  await context.addCookies([{ name: 'session', value: cookie.slice(8), url: server.baseUrl }])
  return context.newPage()
}

/**
 * Records every POST response the page makes while the click runs, so the
 * redirect status is asserted even though the browser follows the 303 to a 200.
 */
async function clickCapturingPostStatus(
  page: Page,
  postUrlPart: string,
  click: () => Promise<void>,
): Promise<number[]> {
  let statuses: number[] = []
  let listener = (response: Response) => {
    if (response.request().method() === 'POST' && response.url().includes(postUrlPart)) {
      statuses.push(response.status())
    }
  }
  page.on('response', listener)
  try {
    await click()
  } finally {
    page.off('response', listener)
  }
  return statuses
}

describe('no-JS agent gate forms', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('submits the suspended /chat approval gate without JS and shows the 303 flash', async (t) => {
    let user = await createUser('customer')
    let runId = crypto.randomUUID()
    __setCustomerTestAgent(makeMockAgent())
    __setTestResumeResolver(async () => ({ messages: [] }))
    customerChatRateLimiter.reset(user.id)
    // The customer gate read joins chat_runs, so the run must own the row.
    await recordChatRun({ runId, userId: user.id, threadId: 'thread-nojs-chat' })
    await markCustomerGateSuspended(user.id, {
      runId,
      threadId: 'thread-nojs-chat',
      gateType: 'tool_decision',
      toolCallId: 'tc-nojs-chat',
      toolName: 'book',
      args: { appointmentSummary: 'Morgen 10:00' },
    })

    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await openNoJsPage(t, server, user.cookie)

      await page.goto(routes.chat.index.href())
      let form = page.locator('#chat-approval')
      await form.waitFor({ timeout: 15_000 })
      // Without JS the CSRF token must already be in the server-rendered form.
      assert.equal(await form.locator('input[name="_csrf"]').count(), 1)

      let statuses = await clickCapturingPostStatus(page, routes.chat.approve.href(), () =>
        form.locator('button.approve-btn').click(),
      )

      await page.locator('text=Aktion bestätigt.').waitFor({ timeout: 15_000 })
      assert.ok(
        statuses.includes(303),
        `the native form POST must answer 303; saw ${statuses.join(', ') || 'no POST response'}`,
      )
      assert.equal(new URL(page.url()).pathname, routes.chat.index.href())
    } finally {
      __setCustomerTestAgent(undefined)
      __setTestResumeResolver(undefined)
      await pool.query('DELETE FROM users WHERE id = $1', [user.id])
    }
  })

  it('submits the support-agent approval gate over the native no-JS transport', async (t) => {
    let admin = await createUser('admin')
    let runId = crypto.randomUUID()
    __setSupportTestAgent(makeMockAgent())
    supportChatRateLimiter.reset(admin.id)
    // The support store uses markMode 'update', so the running row must exist.
    await upsertSupportGate(admin.id, { runId, threadId: 'thread-nojs-support' })
    await markSupportGateSuspended(admin.id, {
      runId,
      threadId: 'thread-nojs-support',
      gateType: 'tool_decision',
      toolCallId: 'tc-nojs-support',
      toolName: 'lookup_user',
      args: { id: 5 },
    })

    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: admin.cookie.slice(8), url: server.baseUrl }])
      // The request context shares the browser context's cookie jar and runs no
      // page JavaScript, so it is the native (no-JS) form transport.
      let request = page.context().request

      // The gate lives in the admin-content frame fragment; confirm the fragment
      // server-renders the native form before posting its fields.
      let fragment = await request.get(routes.admin.supportAgent.index.href(), {
        headers: { 'X-Remix-Target': frames.adminContent },
      })
      assert.equal(fragment.status(), 200)
      let fragmentHtml = await fragment.text()
      assert.ok(
        fragmentHtml.includes('id="support-agent-approval"'),
        'the frame fragment must render the native approval form',
      )
      assert.ok(
        fragmentHtml.includes('action="/admin/support-agent/tool-decision"'),
        'the form must post to the decision route',
      )
      // Submit exactly the token the rendered form carries.
      let token = fragmentHtml.match(/name="_csrf" value="([^"]+)"/)?.[1]
      assert.ok(token, 'the native form must carry a CSRF token')

      let response = await request.post(routes.admin.supportAgent.toolDecision.href(), {
        form: { _csrf: token, runId, decision: 'approve' },
        maxRedirects: 0,
      })
      if (response.status() !== 303) {
        assert.equal(
          response.status(),
          303,
          'the native decision POST must redirect: ' + (await response.text()),
        )
      }
      assert.equal(response.headers()['location'], routes.admin.supportAgent.index.href())

      let flashed = await request.get(routes.admin.supportAgent.index.href())
      assert.equal(flashed.status(), 200)
      assert.ok(
        (await flashed.text()).includes('Aktion genehmigt.'),
        'the follow-up GET must render the decision flash',
      )
    } finally {
      __setSupportTestAgent(undefined)
      await pool.query('DELETE FROM users WHERE id = $1', [admin.id])
    }
  })
})
