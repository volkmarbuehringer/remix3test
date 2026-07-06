import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { messageContentToText } from './message-content.ts'

describe('messageContentToText', () => {
  it('returns plain string as-is', () => {
    assert.equal(messageContentToText('hello'), 'hello')
  })

  it('returns empty string unchanged', () => {
    assert.equal(messageContentToText(''), '')
  })

  it('extracts text from V2 format parts', () => {
    let input = {
      format: 2,
      parts: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world' },
      ],
    }
    assert.equal(messageContentToText(input), 'Hello\n world')
  })

  it('returns empty string when V2 format has only tool-call parts', () => {
    let input = {
      format: 2,
      parts: [
        { type: 'tool-call', toolName: 'get_weather', args: { location: 'Berlin' } },
        { type: 'tool-call', toolName: 'get_time', args: {} },
      ],
    }
    assert.equal(messageContentToText(input), '')
  })

  it('returns empty string when V2 format has only reasoning parts', () => {
    let input = {
      format: 2,
      parts: [{ type: 'reasoning', text: 'Let me think about this...' }],
    }
    assert.equal(messageContentToText(input), '')
  })

  it('extracts text from V2 format with mixed reasoning and text parts', () => {
    let input = {
      format: 2,
      parts: [
        { type: 'reasoning', text: 'thinking...' },
        { type: 'text', text: 'Final answer' },
      ],
    }
    assert.equal(messageContentToText(input), 'Final answer')
  })

  it('extracts text from plain object with text property', () => {
    let input = { text: 'legacy response' }
    assert.equal(messageContentToText(input), 'legacy response')
  })

  it('returns empty string for plain object without text property', () => {
    let input = { foo: 'bar' }
    assert.equal(messageContentToText(input), '')
  })

  it('returns empty string for null', () => {
    assert.equal(messageContentToText(null), '')
  })

  it('returns empty string for undefined', () => {
    assert.equal(messageContentToText(undefined), '')
  })

  it('returns empty string for number', () => {
    assert.equal(messageContentToText(42), '')
  })

  it('joins array of mixed parts', () => {
    let input = [
      { type: 'text', text: 'part1' },
      { format: 2, parts: [{ type: 'text', text: 'part2' }] },
    ]
    assert.equal(messageContentToText(input), 'part1\npart2')
  })

  it('filters out non-text entries in array', () => {
    let input = [
      { type: 'tool-call', toolName: 'get_weather' },
      { type: 'text', text: 'only me' },
      null,
    ]
    assert.equal(messageContentToText(input), 'only me')
  })

  it('returns empty string for array of only non-text entries', () => {
    let input = [
      { type: 'tool-call', toolName: 'get_weather' },
      { format: 2, parts: [{ type: 'reasoning', text: 'hmm' }] },
    ]
    assert.equal(messageContentToText(input), '')
  })

  it('returns empty string for empty object', () => {
    assert.equal(messageContentToText({}), '')
  })
})
