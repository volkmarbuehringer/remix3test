import { afterEach, beforeEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { clearPrefetchedAssets, prefetchFrameAssets } from './frame-asset-prefetch.browser.ts'
import { clearPrefetchedFrames, prefetchFrame } from './frame-prefetch.browser.ts'

// ---------------------------------------------------------------------------
// Prefetch asset discovery
//
// `run({ prefetch })` replaces the vendor default prefetcher, including its
// `<link rel="prefetch">` discovery. These tests drive the replacement directly
// with a real HTML `Response` and assert the hints it would add for a warmed
// frame. The e2e prefetch test (admin-lists) still proves the runtime calls the
// warm hook; this suite isolates the HTML parsing and dedupe rules.
//
// Hints are removed on `load`/`error`, and the test server answers fake asset
// paths with a fast 404. Record insertions with a MutationObserver so the
// assertions do not depend on how long the network takes to settle.
// ---------------------------------------------------------------------------

const SOURCE = new URL('/admin/lists', window.location.origin)

type HintRecorder = {
  hints: HTMLLinkElement[]
  disconnect: () => void
}

let recorder: HintRecorder | null = null

function startRecording(): HintRecorder {
  let hints: HTMLLinkElement[] = []
  let observer = new MutationObserver((records) => {
    for (let record of records) {
      for (let node of record.addedNodes) {
        if (node instanceof HTMLLinkElement && node.rel === 'prefetch') hints.push(node)
      }
    }
  })
  observer.observe(document.head, { childList: true })

  return {
    hints,
    disconnect: () => observer.disconnect(),
  }
}

function recordedHints(): HTMLLinkElement[] {
  return recorder?.hints ?? []
}

function findHint(href: string): HTMLLinkElement | undefined {
  let absolute = new URL(href, SOURCE).href
  return recordedHints().find((hint) => hint.href === absolute)
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

async function warm(html: string): Promise<void> {
  prefetchFrameAssets(htmlResponse(html), SOURCE)
}

/**
 * Wait for the async discovery chain without a fixed sleep. `response.text()`
 * resolves on a microtask; polling macrotasks keeps the suite independent of CI
 * load and of how fast a fake asset request fails.
 */
async function waitFor(predicate: () => boolean, description: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  assert.ok(predicate(), description)
}

beforeEach(() => {
  recorder = startRecording()
})

afterEach(() => {
  recorder?.disconnect()
  recorder = null
  clearPrefetchedAssets()
  clearPrefetchedFrames()
  for (let hint of document.head.querySelectorAll('link[rel="prefetch"]')) hint.remove()
})

describe('frame asset prefetch discovery', () => {
  it('discovers scripts, styles, module preloads, and declared image/font preloads', async () => {
    await warm(`
      <base href="/assets/">
      <script type="module" src="app/assets/entry.js"></script>
      <link rel="stylesheet" href="app/styles/app.css">
      <link rel="modulepreload" href="app/assets/chunk.js">
      <link rel="preload" as="image" href="app/hero.png">
      <link rel="preload" as="font" href="app/font.woff2" crossorigin>
    `)
    await waitFor(() => recordedHints().length === 5, 'expected five asset hints')

    let script = findHint('/assets/app/assets/entry.js')
    assert.ok(script)
    assert.equal(script.as, 'script')
    assert.equal(script.crossOrigin, 'anonymous', 'module scripts are fetched as CORS assets')

    let style = findHint('/assets/app/styles/app.css')
    assert.ok(style)
    assert.equal(style.as, 'style')

    let modulepreload = findHint('/assets/app/assets/chunk.js')
    assert.ok(modulepreload)
    assert.equal(modulepreload.as, 'script')

    let image = findHint('/assets/app/hero.png')
    assert.ok(image)
    assert.equal(image.as, 'image')

    let font = findHint('/assets/app/font.woff2')
    assert.ok(font)
    assert.equal(font.as, 'font')
    assert.equal(font.crossOrigin, 'anonymous')
  })

  it('discovers assets inside nested template content and dedupes repeated hints', async () => {
    await warm(`
      <template>
        <link rel="stylesheet" href="/assets/nested.css">
        <template>
          <script src="/assets/deep.js"></script>
        </template>
      </template>
      <script src="/assets/repeated.js"></script>
      <script src="/assets/repeated.js"></script>
    `)
    await waitFor(
      () =>
        findHint('/assets/nested.css') !== undefined && findHint('/assets/deep.js') !== undefined,
      'expected nested template hints',
    )
    assert.equal(
      recordedHints().filter((hint) => hint.href === new URL('/assets/repeated.js', SOURCE).href)
        .length,
      1,
      'the same asset must not get two hints',
    )
  })

  it('skips assets the current document already has', async () => {
    let existing = document.createElement('link')
    existing.rel = 'stylesheet'
    existing.href = '/assets/existing.css'
    document.head.append(existing)

    try {
      await warm(`
        <link rel="stylesheet" href="/assets/existing.css">
        <script src="/assets/new.js"></script>
      `)
      await waitFor(() => findHint('/assets/new.js') !== undefined, 'expected the new asset hint')

      assert.equal(findHint('/assets/existing.css'), undefined)
      assert.ok(findHint('/assets/new.js'))
    } finally {
      existing.remove()
    }
  })

  it('skips image/font preloads that cannot be selected and imagesrcset candidates', async () => {
    await warm(`
      <link rel="preload" as="image" href="/assets/wide.png" media="(min-width: 99999px)">
      <link rel="preload" as="image" href="/assets/responsive.png" imagesrcset="/assets/2x.png 2x">
      <link rel="preload" as="image" href="/assets/visible.png">
    `)
    await waitFor(() => findHint('/assets/visible.png') !== undefined, 'expected the visible hint')

    assert.equal(findHint('/assets/wide.png'), undefined, 'non-matching media is skipped')
    assert.equal(findHint('/assets/responsive.png'), undefined, 'imagesrcset cannot be prefetched')
    assert.ok(findHint('/assets/visible.png'))
  })

  it('re-creates a hint dropped by head reconciliation', async () => {
    let html = '<script src="/assets/reconciled.js"></script>'
    await warm(html)
    await waitFor(() => findHint('/assets/reconciled.js') !== undefined, 'expected the first hint')

    let first = findHint('/assets/reconciled.js')!
    // Simulate a top-level frame head diff dropping our unmanaged hint. No
    // load/error fires, so the pending entry must be treated as stale.
    first.remove()

    await warm(html)
    await waitFor(
      () =>
        recordedHints().filter(
          (hint) => hint.href === new URL('/assets/reconciled.js', SOURCE).href,
        ).length === 2,
      'a disconnected pending hint must not suppress the asset forever',
    )
  })

  it('ignores non-HTML responses', async () => {
    prefetchFrameAssets(
      new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } }),
      SOURCE,
    )
    // One macrotask is enough for the rejected discovery path to settle.
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(recordedHints().length, 0)
  })

  it('is a no-op for a partial response without clone/text', async () => {
    // Existing prefetch-cache tests use minimal Response-shaped stubs; discovery
    // must not turn those into failures.
    assert.doesNotThrow(() => {
      prefetchFrameAssets({ ok: true, status: 200 } as Response, SOURCE)
    })
  })

  it('runs after the runtime prefetch hook warms a frame', async () => {
    let originalFetch = window.fetch
    window.fetch = (async () =>
      htmlResponse('<script src="/assets/wired-through-prefetch.js"></script>')) as typeof fetch

    try {
      prefetchFrame('/admin/lists', { target: 'admin-content' })
      await waitFor(
        () => findHint('/assets/wired-through-prefetch.js') !== undefined,
        'prefetchFrame must feed the warmed HTML into asset discovery',
      )

      assert.ok(
        findHint('/assets/wired-through-prefetch.js'),
        'prefetchFrame must feed the warmed HTML into asset discovery',
      )
    } finally {
      window.fetch = originalFetch
    }
  })
})
