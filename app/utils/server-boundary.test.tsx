import * as http from 'node:http'
import type { AddressInfo } from 'node:net'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRouter } from 'remix/router'
import { Renderer, render } from 'remix/middleware/render'
import { createRequestListener, type ClientAddress } from 'remix/node-fetch-server'
import type { Handle } from 'remix/component'

import { createServerHandler, handleServerError } from './server-handler.ts'

// ---------------------------------------------------------------------------
// Guide 12 §"Handle uncaught action and middleware errors at the server
// boundary", §"Report streaming render failures", §"Treat request aborts as
// cancellation".
//
// `createRequestListener`'s `onError` is the app's only pre-response boundary:
// a throwing action or a root/blocking render failure must be reported and
// answered with the app 500 page, while an expected client abort must be
// dropped after in-flight work settles (remix #12446) without a 500 log.
// ---------------------------------------------------------------------------

function rawGet(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let request = http.request({ host: '127.0.0.1', port, path }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        body += chunk
      })
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }))
    })
    request.on('error', reject)
    request.end()
  })
}

async function serve(
  router: Parameters<typeof createServerHandler>[0],
): Promise<{ port: number; close: () => Promise<void> }> {
  let handleRequest = createServerHandler(router)
  let server = http.createServer(
    createRequestListener(
      (request: Request, client: ClientAddress) => handleRequest(request, client.address),
      { onError: handleServerError },
    ),
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    port: (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

describe('server error boundary', () => {
  it('answers a throwing action with the app 500 page', async (t) => {
    let logged = t.mock.method(console, 'error')
    let router = createRouter()
    router.get('/', () => {
      throw new Error('handler boom')
    })

    let app = await serve(router)
    try {
      let response = await rawGet(app.port, '/')

      assert.equal(response.status, 500)
      assert.ok(response.body.includes('Serverfehler'), 'the app error page rendered')
      assert.ok(!response.body.includes('handler boom'), 'no exception detail leaks into the body')
      assert.equal(logged.mock.callCount(), 1, 'the boundary reports the exception once')
    } finally {
      await app.close()
    }
  })

  it('rejects a root render failure to the boundary as a reported 500', async (t) => {
    let onError = t.mock.fn()
    let router = createRouter({ middleware: [render({ onError })] })

    function Boom(_handle: Handle) {
      return () => {
        throw new Error('render boom')
      }
    }

    router.get('/', (context) => {
      let renderNode = context.get(Renderer)
      return renderNode(<Boom />)
    })

    let error: unknown
    try {
      await router.fetch('https://remix.run/')
    } catch (caught) {
      error = caught
    }
    assert.ok(error instanceof Error, 'a root render failure must reject router.fetch')
    assert.match((error as Error).message, /render boom/)
    assert.ok(onError.mock.callCount() >= 1, 'the failure is reported through render onError')

    let logged = t.mock.method(console, 'error')
    let app = await serve(router)
    try {
      let response = await rawGet(app.port, '/')

      assert.equal(response.status, 500)
      assert.ok(response.body.includes('Serverfehler'))
      assert.equal(logged.mock.callCount(), 1, 'the server boundary reports its own 500 once')
    } finally {
      await app.close()
    }
  })

  it('drops an expected client abort after in-flight work settles, without a 500 log', async (t) => {
    let logged = t.mock.method(console, 'error')
    let started = Promise.withResolvers<void>()
    let cleanupDone = Promise.withResolvers<void>()
    let router = createRouter()

    router.get('/', async (context) => {
      started.resolve()
      await new Promise<void>((resolve) => {
        context.request.signal.addEventListener(
          'abort',
          () => {
            // Simulate downstream cleanup that outlives the abort notification;
            // #12446 makes the router wait for this before rejecting.
            setTimeout(() => {
              cleanupDone.resolve()
              resolve()
            }, 10)
          },
          { once: true },
        )
      })
      return new Response('late')
    })

    let app = await serve(router)
    let request = http.request({ host: '127.0.0.1', port: app.port, path: '/' })
    request.on('error', () => {})
    request.end()
    try {
      await started.promise
      request.destroy()
      await cleanupDone.promise
      await new Promise((resolve) => setTimeout(resolve, 30))

      assert.equal(
        logged.mock.callCount(),
        0,
        'a request abort is cancellation, not a server failure',
      )
    } finally {
      await app.close()
    }
  })
})
