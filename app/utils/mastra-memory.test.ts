import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { fetchChatThreadPreviews } from './mastra-memory.ts'

// ---------------------------------------------------------------------------
// Conversation preview building
// The helper reads a bounded slice of the opening messages per thread via the
// memory recall API; each thread is isolated so a single failure can't break
// the whole chatlog list.
// ---------------------------------------------------------------------------

/** Build a fake agent whose memory.recall returns the given messages. */
function makeAgent(recall: (opts: { threadId: string; perPage?: number | false }) => Promise<any>) {
  return {
    getMemory: async () => ({ recall }),
  }
}

describe('fetchChatThreadPreviews', () => {
  it('builds the cell preview from the opening user message only', async () => {
    let agent = makeAgent(async () => ({
      messages: [
        { role: 'user', content: 'Wie kann ich einen Termin verschieben?' },
        { role: 'assistant', content: 'Gerne, ich helfe Ihnen dabei.' },
      ],
    }))
    let result = await fetchChatThreadPreviews(agent, ['thread-1'])
    let preview = result.get('thread-1')!

    assert.equal(preview.preview, 'Wie kann ich einen Termin verschieben?')
    assert.ok(
      preview.previewFull.includes('User: Wie kann ich einen Termin verschieben?'),
      'tooltip should label the user turn',
    )
    assert.ok(
      preview.previewFull.includes('Assistant: Gerne, ich helfe Ihnen dabei.'),
      'tooltip should include the first assistant reply',
    )
  })

  it('collapses whitespace and newlines in the cell preview', async () => {
    let agent = makeAgent(async () => ({
      messages: [{ role: 'user', content: '  Hallo\n\nWelt  ' }],
    }))
    let result = await fetchChatThreadPreviews(agent, ['t'])
    assert.equal(result.get('t')!.preview, 'Hallo Welt')
  })

  it('includes multi-line exchange in the tooltip', async () => {
    let agent = makeAgent(async () => ({
      messages: [
        { role: 'user', content: 'Frage eins' },
        { role: 'assistant', content: 'Antwort eins' },
      ],
    }))
    let result = await fetchChatThreadPreviews(agent, ['t'])
    let preview = result.get('t')!
    assert.ok(preview.previewFull.includes('User: Frage eins'))
    assert.ok(preview.previewFull.includes('Assistant: Antwort eins'))
    assert.ok(preview.preview.includes('\n') === false, 'cell preview should stay single-line')
  })

  it('falls back to the first assistant turn when there is no user turn', async () => {
    let agent = makeAgent(async () => ({
      messages: [{ role: 'assistant', content: 'Willkommen! Wie kann ich helfen?' }],
    }))
    let result = await fetchChatThreadPreviews(agent, ['t'])
    let preview = result.get('t')!
    assert.ok(preview.preview.includes('Willkommen! Wie kann ich helfen?'))
    assert.ok(preview.previewFull.includes('Assistant: Willkommen! Wie kann ich helfen?'))
  })

  it('returns empty preview for a thread without user/assistant messages', async () => {
    let agent = makeAgent(async () => ({ messages: [{ role: 'system', content: 'x' }] }))
    let result = await fetchChatThreadPreviews(agent, ['t'])
    assert.equal(result.get('t')!.preview, '')
    assert.equal(result.get('t')!.previewFull, '')
  })

  it('isolates a thread whose recall throws', async () => {
    let agent = makeAgent(async (opts) => {
      if (opts.threadId === 'bad') throw new Error('memory down')
      return { messages: [{ role: 'user', content: 'ok' }] }
    })
    let result = await fetchChatThreadPreviews(agent, ['good', 'bad'])
    assert.equal(result.get('good')!.preview, 'ok')
    assert.equal(result.get('bad')!.preview, '')
    assert.equal(result.get('bad')!.previewFull, '')
  })

  it('does not touch memory when no threads are requested', async () => {
    let recallCalled = false
    let agent = {
      getMemory: async () => ({
        recall: async () => {
          recallCalled = true
          return { messages: [] }
        },
      }),
    }
    let result = await fetchChatThreadPreviews(agent, [])
    assert.equal(result.size, 0)
    assert.equal(recallCalled, false)
  })
})
