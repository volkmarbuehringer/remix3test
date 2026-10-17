import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { router } from '../test-router.ts'
import { system } from '../routes.ts'
import { initializeAppDatabase } from '../db.ts'
import { createServerHandler } from './server-handler.ts'

/**
 * Regression tests for the two-tier IP trust model: the server boundary
 * (`createServerHandler`) must overwrite any client-supplied `X-Client-Ip`
 * with the TCP socket address it is given, so security decisions — the
 * `/callback` localhost guard, login rate limits — can never be spoofed by
 * request headers. The production entrypoints pass `trustProxy: false`
 * (raw socket address) except under the dev HMR runner.
 */
describe('server handler X-Client-Ip boundary', () => {
  let handleRequest: ReturnType<typeof createServerHandler>

  before(async () => {
    await initializeAppDatabase()
    handleRequest = createServerHandler(router)
  })

  it('a spoofed X-Client-Ip header does not pass the /callback localhost guard', async () => {
    // The client sends X-Client-Ip: 127.0.0.1 but the socket address the
    // listener passes to the boundary is external. Without the boundary
    // overwrite this request would get past the guard (400/404/409); with
    // it, the stamped external IP fails the guard (403) before any parsing.
    let response = await handleRequest(
      new Request(`https://remix.run${system.callback.href()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Ip': '127.0.0.1',
        },
        body: JSON.stringify({ id: crypto.randomUUID() }),
      }),
      '203.0.113.1',
    )
    assert.equal(response.status, 403)
  })

  it('a socket-localhost caller passes the guard and fails at body validation instead', async () => {
    // No spoofed header; the boundary stamps the real (loopback) socket
    // address, the guard opens, and the request proceeds far enough to fail
    // on content type (400) — proving the guard accepted the stamped IP.
    let response = await handleRequest(
      new Request(`https://remix.run${system.callback.href()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not json',
      }),
      '127.0.0.1',
    )
    assert.equal(response.status, 400)
  })
})
