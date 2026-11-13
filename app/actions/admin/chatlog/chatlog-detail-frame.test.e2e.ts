import { describe, it, before, afterEach, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import type { Page } from 'playwright'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../../test/utils.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../../test/pool.ts'
import { __setTestChatlogFixtures } from './controller.tsx'

// ---------------------------------------------------------------------------
// Chatlog master–detail — in-place transcript selection, end-to-end.
//
// The conversation list and the transcript pane are siblings: picking a row
// loads the transcript into the nested `admin-chatlog-detail` frame without a
// document navigation, so the list, its pager and its scroll position survive.
// The frame uses the runtime's built-in `loading="lazy"` and starts hidden, so
// the empty "none" transcript is neither resolved into the page (server guard
// in app/actions/admin/admin-chatlog.test.ts) nor fetched by the browser; the
// entry still resolves the named handle and reloads it in place on selection.
//
// Mastra is not configured in tests, so the controller's test seam supplies
// deterministic threads, previews and transcript messages. The seam is only
// active when NODE_ENV=test, which e2e runs under.
// ---------------------------------------------------------------------------

const THREAD_ID = 'e2e-detail-thread'
const SECOND_THREAD_ID = 'e2e-detail-thread-2'
const MESSAGE_TEXT = 'Wie ändere ich meinen Termin?'
const REPLY_TEXT = 'Öffne die Terminübersicht und wähle den Eintrag aus.'
const SECOND_REPLY_TEXT = 'Die zweite Konversation ist geöffnet.'
const CHATLOG_PATH = routes.admin.chatlog.index.href()
const DETAIL_PREFIX = CHATLOG_PATH + '/fragments/detail/'

describe('admin chatlog: in-place transcript selection', () => {
  let adminUserId = ''

  before(async () => {
    await initializeAppDatabase()
    let admin = await pool.query<{ id: number }>('SELECT id FROM users WHERE email = $1 LIMIT 1', [
      'admin@newapp.com',
    ])
    assert.ok(admin.rows[0], 'seeded admin user must exist')
    adminUserId = String(admin.rows[0].id)
  })

  afterEach(() => {
    __setTestChatlogFixtures(undefined)
  })

  function seedChatlog() {
    let now = Date.now()
    __setTestChatlogFixtures({
      threads: [
        { id: THREAD_ID, resourceId: adminUserId, createdAt: now - 60_000, updatedAt: now },
        {
          id: SECOND_THREAD_ID,
          resourceId: adminUserId,
          createdAt: now - 120_000,
          updatedAt: now - 30_000,
        },
      ],
      previews: new Map([
        [THREAD_ID, { preview: MESSAGE_TEXT, previewFull: MESSAGE_TEXT, messageCount: 2 }],
        [
          SECOND_THREAD_ID,
          {
            preview: 'Zweite Konversation',
            previewFull: 'Zweite Konversation',
            messageCount: 2,
          },
        ],
      ]),
      threadLookup: async (threadId) => {
        if (threadId !== THREAD_ID && threadId !== SECOND_THREAD_ID) return null
        let reply = threadId === THREAD_ID ? REPLY_TEXT : SECOND_REPLY_TEXT
        return {
          resourceId: adminUserId,
          messages: [
            { role: 'user' as const, content: MESSAGE_TEXT, timestamp: now - 60_000 },
            { role: 'assistant' as const, content: reply, timestamp: now - 30_000 },
          ],
        }
      },
    })
  }

  async function openChatlog(t: TestContext): Promise<Page> {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
    await page.setViewportSize({ width: 1440, height: 900 })
    return page
  }

  /** Resolves once the master–detail entry has run its setup. */
  function hydrationMarker() {
    return document.querySelector('[data-chatlog-page][data-open-id]') !== null
  }

  it('loads a selected transcript into the pane without leaving the list', async (t) => {
    seedChatlog()
    let page = await openChatlog(t)

    let detailRequests: string[] = []
    page.on('request', (request) => {
      let pathname = new URL(request.url()).pathname
      if (pathname.startsWith(DETAIL_PREFIX)) detailRequests.push(pathname)
    })

    await page.goto(routes.admin.chatlog.index.href())
    await page.locator('[data-chatlog-table]').waitFor({ timeout: 15_000 })
    await page.waitForFunction(hydrationMarker, undefined, { timeout: 15_000 })

    // The pane is closed and the frame is deferred: the browser must not fetch
    // the empty "none" transcript just to render a hidden pane.
    assert.deepEqual(detailRequests, [], 'a closed pane must not request a transcript')

    await page.locator(`a[data-chatlog-open="${THREAD_ID}"]`).first().click()
    await page.getByText(REPLY_TEXT, { exact: true }).waitFor({ timeout: 15_000 })

    assert.equal(new URL(page.url()).pathname, CHATLOG_PATH, 'selection stays on the list URL')
    assert.equal(
      await page.locator('[data-chatlog-table]').count(),
      1,
      'the conversation list must stay rendered',
    )
    assert.equal(
      await page.locator('[data-chatlog-detail-panel]').getAttribute('data-chatlog-detail-open'),
      'true',
      'the pane opens for the selected row',
    )
    assert.deepEqual(detailRequests, [DETAIL_PREFIX + THREAD_ID], 'exactly one transcript request')

    // A second selection reuses the same pane: it must render that thread's own
    // transcript (not the first one still mounted) with one new request.
    await page.locator(`a[data-chatlog-open="${SECOND_THREAD_ID}"]`).first().click()
    await page.getByText(SECOND_REPLY_TEXT, { exact: true }).waitFor({ timeout: 15_000 })
    assert.equal(new URL(page.url()).pathname, CHATLOG_PATH)
    assert.equal(await page.locator('[data-chatlog-table]').count(), 1)
    assert.equal(detailRequests.length, 2, 'each selection loads its own transcript once')
  })

  it('restores the remembered transcript after a document reload', async (t) => {
    seedChatlog()
    let page = await openChatlog(t)

    let detailRequests: string[] = []
    page.on('request', (request) => {
      let pathname = new URL(request.url()).pathname
      if (pathname.startsWith(DETAIL_PREFIX)) detailRequests.push(pathname)
    })

    await page.goto(routes.admin.chatlog.index.href())
    await page.locator('[data-chatlog-table]').waitFor({ timeout: 15_000 })
    await page.waitForFunction(hydrationMarker, undefined, { timeout: 15_000 })

    await page.locator(`a[data-chatlog-open="${THREAD_ID}"]`).first().click()
    await page.getByText(REPLY_TEXT, { exact: true }).waitFor({ timeout: 15_000 })
    assert.deepEqual(detailRequests, [DETAIL_PREFIX + THREAD_ID], 'selection loads one transcript')

    // The panel entry remembers the open thread in sessionStorage. A fresh
    // document renders the pane collapsed (the URL is the list) and the entry
    // must resolve the lazy frame's named handle and reload it in place.
    await page.reload()
    await page.locator('[data-chatlog-table]').waitFor({ timeout: 15_000 })
    await page.getByText(REPLY_TEXT, { exact: true }).waitFor({ timeout: 15_000 })

    assert.equal(
      await page.locator('[data-chatlog-detail-panel]').getAttribute('data-chatlog-detail-open'),
      'true',
      'the remembered transcript reopens after a reload',
    )
    assert.equal(
      detailRequests.length,
      2,
      'the reload restores the transcript without fetching the empty none pane',
    )
    assert.equal(detailRequests[1], DETAIL_PREFIX + THREAD_ID)
  })

  it('loads a transcript opened directly through ?detail', async (t) => {
    seedChatlog()
    let page = await openChatlog(t)

    let detailRequests: string[] = []
    page.on('request', (request) => {
      let pathname = new URL(request.url()).pathname
      if (pathname.startsWith(DETAIL_PREFIX)) detailRequests.push(pathname)
    })
    let documentLoads = 0
    page.on('load', () => {
      documentLoads++
    })

    await page.goto(routes.admin.chatlog.index.href() + '?detail=' + THREAD_ID)
    await page.getByText(REPLY_TEXT, { exact: true }).waitFor({ timeout: 15_000 })

    // The server opens the pane; the entry must keep it open instead of
    // collapsing it for the empty sessionStorage, and the lazy frame must load
    // once through the viewport observer.
    assert.equal(documentLoads, 1, 'the transcript must not trigger a second document load')
    assert.equal(
      await page.locator('[data-chatlog-detail-panel]').getAttribute('data-chatlog-detail-open'),
      'true',
      'a server-rendered selection stays open after hydration',
    )
    assert.equal(
      await page.locator('[data-chatlog-page]').getAttribute('data-chatlog-selected-id'),
      THREAD_ID,
    )
    assert.equal(
      await page.locator('[data-chatlog-table]').count(),
      1,
      'a directly opened transcript keeps the list beside it',
    )
    assert.deepEqual(detailRequests, [DETAIL_PREFIX + THREAD_ID], 'exactly one transcript request')
  })
})
