import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'

import { routes } from '../../../../routes.ts'
import { WebhookComposer } from './webhook-composer.tsx'

// A webhook composer in the admin webhook-requests grid is a client entry in a
// frame-reconciled region. Opening another row's editor reloads the frame, and
// the runtime reuses this entry in place: setup state (the draft rows) survives
// while `handle.props` switches to the new row (guide 05 §"Client navigation").
// Reading the props from setup stored the previous row's payload and submitted
// it to the new row's id, so both live props and the draft identity are pinned
// here.

function rowValues(result: Pick<RenderResult, 'container'>): string[] {
  return [...result.container.querySelectorAll<HTMLInputElement>('tbody input[type="text"]')].map(
    (input) => input.value,
  )
}

function formAction(result: Pick<RenderResult, 'container'>): string | null | undefined {
  return result.container.querySelector('form')?.getAttribute('action')
}

function csrfValue(result: Pick<RenderResult, 'container'>): string | undefined {
  return result.container.querySelector<HTMLInputElement>('input[name="_csrf"]')?.value
}

describe('WebhookComposer edit target', () => {
  it('adopts the new row when a frame reload points the entry at another edit target', async (t) => {
    let result = render(
      <WebhookComposer csrfToken="csrf-test" editId="a" initialPayload='{"alpha":"1"}' />,
    )
    t.after(result.cleanup)

    assert.deepEqual(rowValues(result), ['alpha', '1'])
    assert.equal(
      formAction(result),
      routes.admin.webhookRequests.update.href({ id: 'a' }),
      'the form must submit to the row it opens with',
    )

    assert.equal(
      csrfValue(result),
      'csrf-test',
      'the hidden CSRF field must render the server-provided token, not a DOM read',
    )

    result.root.render(
      <WebhookComposer csrfToken="csrf-test" editId="b" initialPayload='{"beta":"2"}' />,
    )
    result.root.flush()

    assert.deepEqual(
      rowValues(result),
      ['beta', '2'],
      "a reused entry must not keep showing the previous row's payload",
    )
    assert.equal(
      formAction(result),
      routes.admin.webhookRequests.update.href({ id: 'b' }),
      "the previous row's draft must never be submitted to the new row",
    )
  })

  it('keeps the in-progress draft when the same row is re-rendered', async (t) => {
    let result = render(
      <WebhookComposer csrfToken="csrf-test" editId="a" initialPayload='{"alpha":"1"}' />,
    )
    t.after(result.cleanup)

    let input = result.container.querySelector<HTMLInputElement>('tbody input[type="text"]')
    assert.ok(input, 'the payload key field must render')
    await result.act(() => {
      input.value = 'alpha-edited'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.deepEqual(rowValues(result), ['alpha-edited', '1'])

    // Same edit target: the server render may carry new navigation props, but
    // the visitor's draft stays.
    result.root.render(
      <WebhookComposer csrfToken="csrf-test" editId="a" initialPayload='{"alpha":"server"}' />,
    )
    result.root.flush()

    assert.deepEqual(rowValues(result), ['alpha-edited', '1'])
  })
})
