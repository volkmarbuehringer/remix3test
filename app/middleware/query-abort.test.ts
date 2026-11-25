import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createRouter } from 'remix/router'

import { getRequestSignal } from '../utils/request-signal.ts'
import { queryAbortScope } from './query-abort.ts'

describe('queryAbortScope middleware', () => {
  it('exposes the request signal to nested async helpers', async () => {
    let requestSignal: AbortSignal | undefined
    let scopedSignal: AbortSignal | undefined
    let router = createRouter({ middleware: [queryAbortScope()] })

    router.get('/', (context) => {
      requestSignal = context.request.signal
      scopedSignal = getRequestSignal()
      return new Response('ok')
    })

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.ok(requestSignal, 'the handler should receive the request signal')
    assert.equal(scopedSignal, requestSignal, 'helpers should see the same signal object')
  })
})
