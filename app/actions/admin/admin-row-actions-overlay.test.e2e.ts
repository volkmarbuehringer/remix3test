import { afterEach, before, describe, it, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { db, initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { claimUploads, insertUpload } from '../../data/uploads.ts'
import { insertUploadFile } from '../../data/upload-files.ts'
import { insertWebhookRequest } from '../../data/webhook-requests.ts'

// ---------------------------------------------------------------------------
// Persistent-kebab row actions for the four remaining admin grids:
// /admin/uploadnew, /admin/webhook-requests, /admin/uploads and /admin/messages.
//
// These assertions exercise the shared `table.floating*` CSS contract together
// with the hydrated `AdminRowActionsOverlay` entry. The rows are seeded through
// the same data helpers the routes use so the test never depends on demo rows.
// ---------------------------------------------------------------------------

interface RowActionCase {
  label: string
  path: string
  tableSelector: string
  seed: () => Promise<{ rowSelector: string }>
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function waitForOverlayOpacity(
  page: Awaited<ReturnType<typeof openPage>>,
  rowSelector: string,
  expected: '0' | '1',
): Promise<void> {
  await page.waitForFunction(
    ({ selector, opacity }) => {
      let row = document.querySelector(selector)
      let group = row?.querySelector('[data-row-actions]')
      return !!group && getComputedStyle(group).opacity === opacity
    },
    { selector: rowSelector, opacity: expected },
    { timeout: 15_000 },
  )
}

function readActionState(
  page: Awaited<ReturnType<typeof openPage>>,
  rowSelector: string,
): Promise<{
  opacity: string
  pointerEvents: string
  expanded: string | null
  triggerDisplay: string
  triggerWidth: number
  gapToTrigger: number
  actionCellLeft: number
  overlayLeft: number
  overlayHeight: number
  rowHeight: number
  activeIsTrigger: boolean
  activeInActions: boolean
}> {
  return page.evaluate((selector) => {
    let row = document.querySelector(selector) as HTMLElement
    let group = row.querySelector('[data-row-actions]') as HTMLElement
    let trigger = row.querySelector('[data-row-actions-trigger]') as HTMLElement
    let triggerRect = trigger.getBoundingClientRect()
    let groupRect = group.getBoundingClientRect()
    let actionCell = trigger.closest('td') as HTMLElement
    let actionCellRect = actionCell.getBoundingClientRect()
    let rowRect = row.getBoundingClientRect()
    let active = document.activeElement
    return {
      opacity: getComputedStyle(group).opacity,
      pointerEvents: getComputedStyle(group).pointerEvents,
      expanded: trigger.getAttribute('aria-expanded'),
      triggerDisplay: getComputedStyle(trigger).display,
      triggerWidth: triggerRect.width,
      gapToTrigger: triggerRect.left - groupRect.right,
      actionCellLeft: actionCellRect.left,
      overlayLeft: groupRect.left,
      overlayHeight: groupRect.height,
      rowHeight: rowRect.height,
      activeIsTrigger: active === trigger,
      activeInActions: active instanceof Element && active.closest('[data-row-actions]') === group,
    }
  }, rowSelector)
}

let adminId: number
let uploadIds: number[] = []
let uploadFileIds: number[] = []
let webhookSources: string[] = []
let messageIds: number[] = []

async function seedUploadsRow(): Promise<{ rowSelector: string }> {
  let filename = `test-row-actions-uploads-${uniqueSuffix()}.txt`
  let id = Number(
    await insertUpload(db, {
      filename,
      mimeType: 'text/plain',
      buffer: Buffer.from('x'),
      size: 1,
      now: Date.now(),
    }),
  )
  uploadIds.push(id)
  let claimed = await claimUploads(db, [id], adminId, Number.MAX_SAFE_INTEGER)
  assert.ok(claimed, 'seeded admin upload must be claimable')
  return { rowSelector: `[data-uploads-table] [data-row-id="${id}"]` }
}

async function seedUploadNewRow(): Promise<{ rowSelector: string }> {
  let suffix = uniqueSuffix()
  let id = Number(
    await insertUploadFile(db, {
      storageKey: `test-row-actions/${suffix}.txt`,
      filename: `test-row-actions-uploadnew-${suffix}.txt`,
      mimeType: 'text/plain',
      size: 1,
      uploadedBy: adminId,
      now: Date.now(),
    }),
  )
  uploadFileIds.push(id)
  return { rowSelector: `[data-uploadnew-table] [data-upload-new-row="${id}"]` }
}

async function seedWebhookRow(): Promise<{ rowSelector: string }> {
  let sourceIp = `test-row-actions-webhook-${uniqueSuffix()}`
  webhookSources.push(sourceIp)
  let id = await insertWebhookRequest(db, {
    payload: JSON.stringify({ marker: sourceIp }),
    headers: '{}',
    sourceIp,
    now: Date.now(),
  })
  return { rowSelector: `[data-webhook-requests-table] [data-webhook-request-row="${id}"]` }
}

async function seedMessageRow(): Promise<{ rowSelector: string }> {
  let content = `test-row-actions-message-${uniqueSuffix()}`
  let result = await pool.query(
    `INSERT INTO messages (sender_id, content, created_at)
     VALUES ((SELECT id FROM users WHERE email = 'admin@newapp.com'), $1, $2)
     RETURNING id`,
    [content, Date.now()],
  )
  let id = Number(result.rows[0]?.id)
  assert.ok(Number.isFinite(id), 'seeded message must have an id')
  messageIds.push(id)
  return { rowSelector: `[data-messages-table] [data-row-id="${id}"]` }
}

const CASES: RowActionCase[] = [
  {
    label: 'uploadnew',
    path: routes.admin.uploadnew.index.href(),
    tableSelector: '[data-uploadnew-table]',
    seed: seedUploadNewRow,
  },
  {
    label: 'webhook-requests',
    path: routes.admin.webhookRequests.index.href(),
    tableSelector: '[data-webhook-requests-table]',
    seed: seedWebhookRow,
  },
  {
    label: 'uploads',
    path: routes.admin.uploads.index.href(),
    tableSelector: '[data-uploads-table]',
    seed: seedUploadsRow,
  },
  {
    label: 'messages',
    path: routes.admin.messages.index.href(),
    tableSelector: '[data-messages-table]',
    seed: seedMessageRow,
  },
]

async function openPage(t: TestContext, rowCase: RowActionCase, rowSelector: string) {
  let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
  assert.ok(auth?.cookie, 'admin session must be created')

  let server = await createTestServer((request) => router.fetch(request))
  let page = await t.serve(server)
  await page
    .context()
    .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(rowCase.path)
  await page.locator(rowCase.tableSelector).waitFor({ timeout: 15_000 })
  await page.locator(rowSelector).waitFor({ timeout: 15_000 })
  await page
    .locator('[data-admin-row-actions-ready="true"]')
    .waitFor({ state: 'attached', timeout: 15_000 })
  return page
}

describe('admin row actions overlay', () => {
  before(async () => {
    await initializeAppDatabase()
    let result = await db.exec("SELECT id FROM users WHERE email = 'admin@newapp.com'")
    adminId = Number((result.rows?.[0] as { id: number } | undefined)?.id)
    assert.ok(Number.isFinite(adminId), 'expected seeded admin@newapp.com to exist')
  })

  afterEach(async () => {
    if (uploadIds.length > 0) {
      await pool.query('DELETE FROM uploads WHERE id = ANY($1)', [uploadIds])
      uploadIds = []
    }
    if (uploadFileIds.length > 0) {
      await pool.query('DELETE FROM upload_files WHERE id = ANY($1)', [uploadFileIds])
      uploadFileIds = []
    }
    if (webhookSources.length > 0) {
      await pool.query('DELETE FROM webhook_requests WHERE source_ip = ANY($1)', [webhookSources])
      webhookSources = []
    }
    if (messageIds.length > 0) {
      await pool.query('DELETE FROM messages WHERE id = ANY($1)', [messageIds])
      messageIds = []
    }
  })

  for (let rowCase of CASES) {
    it(`${rowCase.label}: keeps actions closed at rest and reveals them from the kebab`, async (t) => {
      let { rowSelector } = await rowCase.seed()
      let page = await openPage(t, rowCase, rowSelector)
      let row = page.locator(rowSelector)
      let trigger = row.locator('[data-row-actions-trigger]')
      let group = row.locator('[data-row-actions]')

      let resting = await readActionState(page, rowSelector)
      assert.equal(resting.opacity, '0', `${rowCase.label}: actions must be hidden at rest`)
      assert.equal(
        resting.pointerEvents,
        'none',
        `${rowCase.label}: hidden actions must not intercept clicks`,
      )
      assert.equal(resting.expanded, 'false', `${rowCase.label}: kebab must start collapsed`)
      assert.notEqual(
        resting.triggerDisplay,
        'none',
        `${rowCase.label}: kebab must stay visible on desktop`,
      )
      assert.ok(resting.triggerWidth > 0, `${rowCase.label}: kebab needs a clickable box`)
      assert.ok(
        resting.gapToTrigger >= -0.5 && resting.gapToTrigger <= 1,
        `${rowCase.label}: overlay must touch the kebab, got a ${resting.gapToTrigger}px gap`,
      )

      // Hovering a normal row cell must not reveal the action overlay.
      await row.locator('td').first().hover()
      let rowHover = await readActionState(page, rowSelector)
      assert.equal(
        rowHover.opacity,
        '0',
        `${rowCase.label}: row hover must leave the actions hidden`,
      )

      // The kebab is the pointer reveal surface.
      await trigger.hover()
      await waitForOverlayOpacity(page, rowSelector, '1')
      let triggerHover = await readActionState(page, rowSelector)
      assert.equal(triggerHover.opacity, '1', `${rowCase.label}: kebab hover reveals actions`)
      if (rowCase.label === 'uploads') {
        assert.ok(
          triggerHover.overlayLeft >= triggerHover.actionCellLeft - 0.5,
          `uploads: the revealed actions must stay inside the Aktionen column, got ${triggerHover.overlayLeft - triggerHover.actionCellLeft}px overlap`,
        )
        assert.ok(
          triggerHover.overlayHeight <= triggerHover.rowHeight + 0.5,
          `uploads: the revealed actions must fit the row height, got ${triggerHover.overlayHeight}px for a ${triggerHover.rowHeight}px row`,
        )
      }

      // The overlay touches the kebab, so entering the actions keeps them open.
      await group.locator('a[href], button').first().hover()
      await waitForOverlayOpacity(page, rowSelector, '1')
      let overlayHover = await readActionState(page, rowSelector)
      assert.equal(
        overlayHover.opacity,
        '1',
        `${rowCase.label}: moving into the overlay must keep it open`,
      )

      // Clicking the kebab pins the overlay. Once pinned it stays open after
      // the pointer leaves the row.
      await page.mouse.move(2, 2)
      await waitForOverlayOpacity(page, rowSelector, '0')
      await trigger.click()
      await waitForOverlayOpacity(page, rowSelector, '1')
      let pinned = await readActionState(page, rowSelector)
      assert.equal(pinned.expanded, 'true', `${rowCase.label}: click must pin the overlay`)
      assert.ok(
        pinned.activeInActions,
        `${rowCase.label}: opening from the kebab must focus the first action`,
      )

      await page.mouse.move(2, 2)
      let stillPinned = await readActionState(page, rowSelector)
      assert.equal(
        stillPinned.opacity,
        '1',
        `${rowCase.label}: pinned actions must stay open after pointer leave`,
      )

      // Escape closes the pinned state and returns focus to the kebab.
      await page.keyboard.press('Escape')
      let escaped = await readActionState(page, rowSelector)
      assert.equal(escaped.expanded, 'false', `${rowCase.label}: Escape must close the pin`)
      assert.ok(escaped.activeIsTrigger, `${rowCase.label}: Escape must restore trigger focus`)

      // An outside pointerdown closes the pinned state too.
      await trigger.click()
      let reopened = await readActionState(page, rowSelector)
      assert.equal(reopened.expanded, 'true', `${rowCase.label}: kebab must reopen the pin`)
      await page.mouse.click(2, 2)
      let outsideClosed = await readActionState(page, rowSelector)
      assert.equal(
        outsideClosed.expanded,
        'false',
        `${rowCase.label}: outside pointerdown must close the pin`,
      )

      // Keyboard focus still reveals the CSS-only action cluster without pinning
      // it (`aria-expanded` stays false).
      await page.evaluate(() => {
        let active = document.activeElement
        if (active instanceof HTMLElement) active.blur()
      })
      await page.mouse.move(2, 2)
      await waitForOverlayOpacity(page, rowSelector, '0')
      await trigger.focus()
      await page.keyboard.press('Tab')
      await waitForOverlayOpacity(page, rowSelector, '1')
      let keyboardFocus = await readActionState(page, rowSelector)
      assert.equal(
        keyboardFocus.opacity,
        '1',
        `${rowCase.label}: keyboard focus must reveal actions`,
      )
      assert.equal(
        keyboardFocus.expanded,
        'false',
        `${rowCase.label}: focus reveal must not pin the overlay`,
      )
      assert.ok(
        keyboardFocus.activeInActions,
        `${rowCase.label}: Tab must land in the revealed action cluster`,
      )
    })
  }
})
