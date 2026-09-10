import { describe, it, before, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { theme } from '../../../ui/theme/theme.ts'

// ---------------------------------------------------------------------------
// /admin/uploads dropzone interactions — end-to-end behavior.
//
// Covers the client-entry affordances layered on the server-rendered file input:
//   - clicking the dashed box (not just the label) opens the native picker,
//     exactly once,
//   - a file dropped on the dropzone becomes a themed pending chip,
//   - a file dropped anywhere else is cancelled and explained, instead of the
//     browser navigating away to open the file,
//   - drags that carry no files are left to the browser, so native drops (e.g.
//     dragging text into the search field) keep working.
//
// All four steps share one page on purpose: the suite runs many browser
// sessions in parallel, and each extra session competes for CPU with the
// SSE-driven e2e tests (see the remix-test-parallel-interference pattern).
//
// The grid may be empty in a fresh test database, so readiness is keyed on the
// dropzone's own hydration marker rather than on `[data-uploads-table]`.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('admin uploads: dropzone interactions', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  async function openUploadsPage(t: TestContext) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.uploads.index.href())
    await page
      .locator('[data-upload-form][data-dropzone-ready="true"]')
      .waitFor({ timeout: 15_000 })
    return page
  }

  it('opens the picker, keeps dropped files themed, and cancels stray file drops', async (t) => {
    let page = await openUploadsPage(t)

    // 1) Clicking the empty right-hand side of the dashed box (not the label,
    //    not the input) must open exactly one picker.
    let opened = 0
    page.on('filechooser', () => {
      opened++
    })
    let dropzone = page.locator('[data-dropzone]')
    let box = await dropzone.boundingBox()
    assert.ok(box, 'dropzone must be laid out')
    let chooser = page.waitForEvent('filechooser', { timeout: 5_000 })
    await dropzone.click({ position: { x: box.width - 24, y: Math.round(box.height / 2) } })
    await chooser
    await page.waitForTimeout(300)
    assert.equal(opened, 1, 'one click on the dropzone box must open exactly one picker')

    // 2) A file dropped on the dropzone becomes a pending chip, styled from the
    //    theme tokens (a doubly-wrapped token silently leaves it unstyled).
    let dropped = await page.evaluate(
      (tokens: { surface: string; border: string }) => {
        let zone = document.querySelector('[data-dropzone]')!
        let data = new DataTransfer()
        data.items.add(new File(['hello'], 'dropped-inside.txt', { type: 'text/plain' }))
        let options = { bubbles: true, cancelable: true, dataTransfer: data }
        zone.dispatchEvent(new DragEvent('dragover', options))
        zone.dispatchEvent(new DragEvent('drop', options))

        let resolve = (token: string) => {
          let probe = document.createElement('span')
          probe.style.color = token
          document.body.appendChild(probe)
          let color = getComputedStyle(probe).color
          probe.remove()
          return color
        }

        let list = document.querySelector('[data-pending-list]')
        let input = document.querySelector<HTMLInputElement>('[data-file-input]')
        let chip = list?.querySelector('li')
        let chipStyle = chip ? getComputedStyle(chip) : null

        return {
          chips: list?.textContent ?? '',
          chipsHidden: list?.hasAttribute('hidden') ?? true,
          files: input?.files?.length ?? 0,
          chipBackground: chipStyle?.backgroundColor ?? '',
          chipBorder: `${chipStyle?.borderTopWidth ?? ''} ${chipStyle?.borderTopStyle ?? ''} ${chipStyle?.borderTopColor ?? ''}`,
          expectedBackground: resolve(tokens.surface),
          expectedBorder: `1px solid ${resolve(tokens.border)}`,
        }
      },
      { surface: theme.surface.lvl3, border: theme.colors.border.default },
    )

    assert.equal(dropped.chipsHidden, false, 'the pending list must be visible')
    assert.ok(
      dropped.chips.includes('dropped-inside.txt'),
      `expected the dropped file in the pending chips, got "${dropped.chips}"`,
    )
    assert.equal(dropped.files, 1, 'the dropped file must land in the hidden input')
    assert.equal(
      dropped.chipBackground,
      dropped.expectedBackground,
      'the pending chip must use the themed surface background',
    )
    assert.equal(
      dropped.chipBorder,
      dropped.expectedBorder,
      'the pending chip must use the themed border',
    )

    // 3) A file dropped elsewhere is cancelled, explained, and does not navigate.
    let urlBefore = page.url()
    let outside = await page.evaluate(() => {
      let target = document.querySelector('h1')!
      let data = new DataTransfer()
      data.items.add(new File(['x'], 'dropped-outside.txt', { type: 'text/plain' }))
      let options = { bubbles: true, cancelable: true, dataTransfer: data }
      let dragoverCanceled = !target.dispatchEvent(new DragEvent('dragover', options))
      let dropCanceled = !target.dispatchEvent(new DragEvent('drop', options))

      let validation = document.querySelector('[data-upload-validation]')
      return {
        dragoverCanceled,
        dropCanceled,
        hint: validation?.textContent ?? '',
        hintHidden: validation?.hasAttribute('hidden') ?? true,
      }
    })

    assert.ok(outside.dragoverCanceled, 'a file dragover outside the dropzone must be cancelled')
    assert.ok(outside.dropCanceled, 'a file drop outside the dropzone must be cancelled')
    assert.equal(outside.hintHidden, false, 'the drop hint must be shown')
    assert.equal(outside.hint, 'Bitte Dateien in das Feld oben ziehen.')
    await page.waitForTimeout(300)
    assert.equal(page.url(), urlBefore, 'a stray file drop must not navigate away')

    // 4) Drags without files stay with the browser: cancelling `dragover` marks an
    //    element as a drop target, so doing it for every drag would swallow
    //    native drops such as text dragged into the search field.
    let fileless = await page.evaluate(() => {
      let input = document.querySelector('input[name="filter"]')!
      let data = new DataTransfer()
      data.setData('text/plain', 'dragged text')
      let options = { bubbles: true, cancelable: true, dataTransfer: data }
      return {
        dragoverCanceled: !input.dispatchEvent(new DragEvent('dragover', options)),
        dropCanceled: !input.dispatchEvent(new DragEvent('drop', options)),
      }
    })

    assert.equal(fileless.dragoverCanceled, false, 'a text dragover must reach the browser')
    assert.equal(fileless.dropCanceled, false, 'a text drop must reach the browser')
  })
})
