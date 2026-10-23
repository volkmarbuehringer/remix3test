import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import * as s from 'remix/data-schema'

import { MAX_MESSAGE_LENGTH } from '../../utils/message-limits.ts'
import { promptIssueMessage, promptSchema } from './controller.tsx'

function submission(fields: Record<string, FormDataEntryValue>): FormData {
  let data = new FormData()
  for (let [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

describe('promptSchema', () => {
  it('trims a valid message', () => {
    let parsed = s.parseSafe(promptSchema, submission({ message: '  hi  ' }))
    assert.ok(parsed.success)
    assert.equal(parsed.value.message, 'hi')
  })

  it('rejects a whitespace-only message as required', () => {
    let parsed = s.parseSafe(promptSchema, submission({ message: '   \n\t ' }))
    assert.ok(!parsed.success)
    assert.equal(promptIssueMessage(parsed.issues[0]?.message), 'Message is required')
  })

  it('rejects a missing message field (no silent empty catch-all)', () => {
    // `s.defaulted` would have parsed a missing field as '' without running the
    // required check — the schema deliberately drops the fallback so this
    // fails fast like the pre-schema hand-rolled check did.
    let parsed = s.parseSafe(promptSchema, submission({}))
    assert.ok(!parsed.success)
    assert.equal(promptIssueMessage(parsed.issues[0]?.message), 'Message is required')
  })

  it('checks length before trimming, so padded overlong input is rejected as too long', () => {
    let padded = '  ' + 'x'.repeat(MAX_MESSAGE_LENGTH + 1) + '  '
    let parsed = s.parseSafe(promptSchema, submission({ message: padded }))
    assert.ok(!parsed.success)
    assert.equal(
      promptIssueMessage(parsed.issues[0]?.message),
      `Message too long (max ${MAX_MESSAGE_LENGTH})`,
    )

    // The same content, unpadded, fits and survives.
    let exact = 'x'.repeat(MAX_MESSAGE_LENGTH)
    let ok = s.parseSafe(promptSchema, submission({ message: exact }))
    assert.ok(ok.success)
    assert.equal(ok.value.message, exact)
  })

  it('maps a non-string message (posted File) to the required message', () => {
    let parsed = s.parseSafe(promptSchema, submission({ message: new File(['x'], 'x.txt') }))
    assert.ok(!parsed.success)
    assert.equal(promptIssueMessage(parsed.issues[0]?.message), 'Message is required')
  })
})

describe('promptIssueMessage', () => {
  it('passes the two canonical messages through verbatim', () => {
    assert.equal(promptIssueMessage('Message is required'), 'Message is required')
    assert.equal(
      promptIssueMessage(`Message too long (max ${MAX_MESSAGE_LENGTH})`),
      `Message too long (max ${MAX_MESSAGE_LENGTH})`,
    )
  })

  it('folds schema type messages into "Message is required"', () => {
    assert.equal(promptIssueMessage('Expected string'), 'Message is required')
    assert.equal(promptIssueMessage('Expected text field "message"'), 'Message is required')
    assert.equal(promptIssueMessage(undefined), 'Message is required')
  })
})
