import * as http from 'node:http'
import type { AddressInfo } from 'node:net'

import * as assert from 'remix/assert'
import { createRequestListener } from 'remix/node-fetch-server'
import { describe, it } from 'remix/test'

import { isMalformedRequestError } from './request-errors.ts'
import { handleServerError } from './server-handler.ts'

const MALFORMED_MESSAGES = [
  'Invalid request target: backslash in path',
  'Invalid request authority',
  'Host header does not match :authority',
]

type RawResponse = {
  status: number
  body: string
  headers: http.IncomingHttpHeaders
}

function get(port: number, path: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    let request = http.request({ host: '127.0.0.1', port, path }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        body += chunk
      })
      response.on('end', () => {
        resolve({ status: response.statusCode ?? 0, body, headers: response.headers })
      })
    })
    request.on('error', reject)
    request.end()
  })
}

describe('request errors', () => {
  it('classifies the vendor malformed-request messages', () => {
    for (let message of MALFORMED_MESSAGES) {
      assert.ok(
        isMalformedRequestError(new Error(message)),
        `${message} should be treated as a client error`,
      )
    }
    assert.equal(isMalformedRequestError(new Error('boom')), false)
    assert.equal(isMalformedRequestError('Invalid request authority'), false)
    assert.equal(isMalformedRequestError(undefined), false)
  })

  it('keeps the 500 page and the log line for real server errors', (t) => {
    let logged = t.mock.method(console, 'error')

    let response = handleServerError(new Error('boom'))

    assert.equal(response.status, 500)
    assert.equal(logged.mock.callCount(), 1)
  })

  it('answers 400 for a backslash target and never calls the handler', async () => {
    let handled = 0
    let server = http.createServer(
      createRequestListener(
        () => {
          handled += 1
          return new Response('ok')
        },
        { onError: handleServerError },
      ),
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    let port = (server.address() as AddressInfo).port

    try {
      let malformed = await get(port, '/admin\\lists')
      assert.equal(malformed.status, 400)
      assert.equal(malformed.body, 'Bad Request')
      assert.equal(malformed.headers['x-content-type-options'], 'nosniff')
      assert.equal(malformed.headers['cache-control'], 'no-store')
      assert.equal(handled, 0, 'the router must not see a malformed request target')

      // The query string keeps accepting backslashes, matching the vendor rule.
      let valid = await get(port, '/lists?returnTo=/a\\b')
      assert.equal(valid.status, 200)
      assert.equal(valid.body, 'ok')
      assert.equal(handled, 1)
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })
})
