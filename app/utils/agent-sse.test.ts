import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { createRunSignal, errorToText } from './agent-sse.ts'
import { delay } from './async.ts'

describe('createRunSignal', () => {
  it('aborts the run when the request signal aborts', () => {
    let request = new AbortController()
    let run = createRunSignal(request.signal, 60_000)

    assert.equal(run.signal.aborted, false)
    request.abort()
    assert.equal(run.signal.aborted, true)

    run.cleanup()
  })

  it('is already aborted when the request signal is', () => {
    let request = new AbortController()
    request.abort()

    let run = createRunSignal(request.signal, 60_000)
    assert.equal(run.signal.aborted, true)

    run.cleanup()
  })

  it('aborts the run after the whole-run timeout', async () => {
    let run = createRunSignal(undefined, 10)

    assert.equal(run.signal.aborted, false)
    await delay(60)
    assert.equal(run.signal.aborted, true)

    run.cleanup()
  })

  it('cleanup clears the pending timeout', async () => {
    let run = createRunSignal(undefined, 10)
    run.cleanup()

    await delay(60)
    assert.equal(run.signal.aborted, false)
  })
})

describe('errorToText', () => {
  it('passes a string through unchanged', () => {
    assert.equal(errorToText('Fehler'), 'Fehler')
  })

  it('reads the message off an Error', () => {
    assert.equal(errorToText(new Error('boom')), 'boom')
  })

  it('serializes an object instead of rendering [object Object]', () => {
    assert.equal(
      errorToText({ code: 'E_BOOKING', detail: 'nope' }),
      '{"code":"E_BOOKING","detail":"nope"}',
    )
  })

  it('falls back to a readable default for nullish errors', () => {
    assert.equal(errorToText(null), 'Unbekannter Fehler')
    assert.equal(errorToText(undefined), 'Unbekannter Fehler')
  })
})
