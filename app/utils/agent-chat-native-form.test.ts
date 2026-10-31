import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { completeNativeForm, createNativeTurnGuard } from './agent-chat.ts'

const MESSAGES = {
  success: 'Nachricht gesendet.',
  error: 'Nachricht konnte nicht gesendet werden.',
  redirectTo: '/chat',
}

function recordingContext() {
  let flashes: Array<{ key: 'success' | 'error'; value: string }> = []
  return {
    flashes,
    context: {
      session: {
        flash(key: 'success' | 'error', value: string) {
          flashes.push({ key, value })
        },
      },
    },
  }
}

function assertRedirect(response: Response): void {
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('Location'), '/chat')
}

describe('completeNativeForm', () => {
  it('redirects with a success flash after a drained 200 stream', async () => {
    let { context, flashes } = recordingContext()

    let response = await completeNativeForm(
      context,
      async () => new Response('event: message\ndata: {"text":"hi"}\n\n'),
      MESSAGES,
    )

    assertRedirect(response)
    assert.equal(flashes.length, 1)
    assert.equal(flashes[0]!.key, 'success')
    assert.equal(flashes[0]!.value, MESSAGES.success)
  })

  it('reports an agent-error frame as an error flash', async () => {
    let { context, flashes } = recordingContext()

    let response = await completeNativeForm(
      context,
      async () => new Response('event: agent-error\ndata: {"error":"nope"}\n\n'),
      MESSAGES,
    )

    assertRedirect(response)
    assert.equal(flashes[0]!.key, 'error')
    assert.equal(flashes[0]!.value, MESSAGES.error)
  })

  it('reports a non-200 response as an error flash', async () => {
    let { context, flashes } = recordingContext()

    let response = await completeNativeForm(
      context,
      async () => new Response('nope', { status: 500 }),
      MESSAGES,
    )

    assertRedirect(response)
    assert.equal(flashes[0]!.key, 'error')
  })

  it('reports a thrown run as an error flash', async () => {
    let { context, flashes } = recordingContext()

    let response = await completeNativeForm(
      context,
      async () => {
        throw new Error('boom')
      },
      MESSAGES,
    )

    assertRedirect(response)
    assert.equal(flashes[0]!.key, 'error')
  })

  it('bounds a stream that never closes and redirects with an error flash', async () => {
    let { context, flashes } = recordingContext()
    let body = new ReadableStream({ start() {} })

    let response = await completeNativeForm(context, async () => new Response(body), MESSAGES, 20)

    assertRedirect(response)
    assert.equal(flashes.length, 1)
    assert.equal(flashes[0]!.key, 'error')
    assert.equal(flashes[0]!.value, MESSAGES.error)
  })
})

describe('createNativeTurnGuard', () => {
  it('allows one in-flight turn per actor and releases the slot', () => {
    let guard = createNativeTurnGuard()

    assert.equal(guard.tryBegin(7), true)
    assert.equal(guard.tryBegin(7), false, 'a second native turn must be rejected')

    guard.end(7)
    assert.equal(guard.tryBegin(7), true, 'the slot must be reusable after the turn')
  })

  it('keeps actors independent', () => {
    let guard = createNativeTurnGuard()

    assert.equal(guard.tryBegin(1), true)
    assert.equal(guard.tryBegin(2), true)
    guard.end(1)
    assert.equal(guard.tryBegin(2), false)
  })
})
