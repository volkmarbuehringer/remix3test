import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { RequestContext } from 'remix/router'
import type { ScriptEntry } from 'remix/assets'
import { asyncContext } from 'remix/middleware/async-context'
import { Logger } from 'remix/middleware/logger'

import { assetServer } from '../assets.ts'
import { getAssetEntry, loadAssetEntry } from './asset-entry.ts'

// ---------------------------------------------------------------------------
// loadAssetEntry — the document-only asset entry lookup.
//
// Frame responses must not load the asset graph (they are reconciled into a
// document that already has the import map), and a failed lookup must not be
// swallowed: without the entry the document ships no import map and the client
// runtime (and therefore every frame) never starts.
// ---------------------------------------------------------------------------

const entry = {
  href: '/assets/entry.js',
  importMap: { imports: {} },
  preloads: [],
} as unknown as ScriptEntry

function makeContext(headers: Record<string, string> = {}) {
  let store = new Map<object, unknown>()
  let logs: string[] = []
  let context = {
    request: new Request('https://test/', { headers }),
    url: new URL('https://test/'),
    set(key: object, value: unknown) {
      store.set(key, value)
    },
    get(key: object) {
      return store.get(key)
    },
    has(key: object) {
      return store.has(key)
    },
  } as unknown as RequestContext
  context.set(Logger, (message: string) => logs.push(message))
  return { context, logs }
}

async function loadEntry(context: RequestContext): Promise<ScriptEntry | undefined> {
  let seen: ScriptEntry | undefined
  let middleware = loadAssetEntry()
  await asyncContext()(context, async () =>
    middleware(context, async () => {
      seen = getAssetEntry()
      return new Response('ok')
    }),
  )
  return seen
}

async function withEntry(impl: () => Promise<ScriptEntry>, run: () => Promise<void>) {
  let original = assetServer.getScriptEntry
  assetServer.getScriptEntry = impl
  try {
    await run()
  } finally {
    assetServer.getScriptEntry = original
  }
}

describe('loadAssetEntry', () => {
  it('loads the entry for a document request', async () => {
    await withEntry(
      async () => entry,
      async () => {
        let { context } = makeContext()
        assert.equal(await loadEntry(context), entry)
      },
    )
  })

  it('treats a non-"true" X-Remix-Frame value as a document request', async () => {
    let calls = 0
    await withEntry(
      async () => {
        calls++
        return entry
      },
      async () => {
        let { context } = makeContext({ 'X-Remix-Frame': 'false' })
        assert.equal(await loadEntry(context), entry)
        assert.equal(calls, 1, 'a "false" header must not skip the asset graph')
      },
    )
  })

  it('skips the asset graph for a frame request', async () => {
    let calls = 0
    await withEntry(
      async () => {
        calls++
        return entry
      },
      async () => {
        let { context } = makeContext({ 'X-Remix-Frame': 'true' })
        assert.equal(await loadEntry(context), undefined)
        assert.equal(calls, 0, 'a frame response has no use for the entry or import map')
      },
    )
  })

  it('reports a failed entry load and still serves the request', async () => {
    await withEntry(
      async () => {
        throw new Error('asset graph unavailable')
      },
      async () => {
        let { context, logs } = makeContext()
        let response = await asyncContext()(context, async () =>
          loadAssetEntry()(context, async () => new Response('still served')),
        )
        assert.equal(response.status, 200)
        assert.equal(logs.length, 1, 'the failure must be reported, not swallowed')
        assert.ok(logs[0]!.includes('asset graph unavailable'))
      },
    )
  })
})
