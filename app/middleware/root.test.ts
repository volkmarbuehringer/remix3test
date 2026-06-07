import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { MiddlewareContext } from 'remix/router'

import { skipAssetsLogger } from './root.ts'

function context(url: string): MiddlewareContext<any> {
  let log = console.log
  let warn = console.warn
  return {
    get: () => log,
    set(_key: object, value: unknown, opts?: { property?: string }) {
      if (opts?.property === 'logger') {
        log = value as typeof console.log
      }
    },
    has: () => true,
    url: new URL(url),
    request: new Request(url),
  } as unknown as MiddlewareContext<any>
}

describe('skipAssetsLogger', () => {
  it('logs non-asset requests', async () => {
    let lines: string[] = []
    let origLog = console.log
    console.log = (msg: unknown) => { lines.push(String(msg)) }

    let mw = skipAssetsLogger()
    await mw(context('https://test/admin/users'), async () => new Response('ok', { status: 200 }))

    console.log = origLog
    assert.equal(lines.length, 1)
    assert.ok(lines[0].includes('/admin/users'))
  })

  it('skips logging for successful asset requests', async () => {
    let lines: string[] = []
    let origLog = console.log
    console.log = (msg: unknown) => { lines.push(String(msg)) }

    let mw = skipAssetsLogger()
    await mw(context('https://test/assets/app/ui/main.js'), async () => new Response('ok', { status: 200 }))

    console.log = origLog
    assert.equal(lines.length, 0)
  })

  it('warns for failing asset requests', async () => {
    let warns: string[] = []
    let origWarn = console.warn
    let origLog = console.log
    console.warn = (msg: unknown) => { warns.push(String(msg)) }
    console.log = () => {}

    let mw = skipAssetsLogger()
    let ctx = context('https://test/assets/missing.js')
    await mw(ctx, async () => new Response('Not Found', { status: 404 }))

    console.warn = origWarn
    console.log = origLog
    assert.equal(warns.length, 1)
    assert.ok(warns[0].includes('/assets/missing.js'))
    assert.ok(warns[0].includes('404'))
  })
})
