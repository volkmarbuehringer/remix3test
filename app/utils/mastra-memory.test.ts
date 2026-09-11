import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  fetchChatThreadPreviews,
  getChatThread,
  listAllChatThreads,
  listChatThreads,
  listLatestCustomerThread,
} from './mastra-memory.ts'

// ---------------------------------------------------------------------------
// Conversation preview building
// The helper reads a bounded slice of the opening messages per thread via the
// memory recall API; each thread is isolated so a single failure can't break
// the whole chatlog list.
// ---------------------------------------------------------------------------

/** Build a fake agent whose memory.recall returns the given messages. */
function makeAgent(
  recall: (opts: {
    threadId: string
    perPage?: number | false
  }) => Promise<{ messages?: unknown[] }>,
) {
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

// ---------------------------------------------------------------------------
// Latest thread per resource (the /chat resume path)
// The index route resolves the customer's most recent conversation via
// listLatestCustomerThread, which scopes the query to the customer's resource.
// These tests pin that contract: the resourceId filter is passed, the ordering is
// updatedAt DESC, and the newest thread's id wins. That scoping is the boundary
// that keeps a customer from resuming someone else's conversation.
// ---------------------------------------------------------------------------

interface ListThreadsOpts {
  page: number
  perPage: number
  orderBy: { field: string; direction: string }
  filter?: { resourceId?: string; metadata?: Record<string, unknown> }
}

function makeListAgent(onList: (opts: ListThreadsOpts) => unknown) {
  return {
    getMemory: async () => ({ listThreads: async (opts: ListThreadsOpts) => onList(opts) }),
  }
}

describe('listLatestCustomerThread', () => {
  it('queries the most recent thread scoped to the resource and returns its id', async () => {
    let captured: ListThreadsOpts | undefined
    let agent = makeListAgent((opts) => {
      captured = opts
      return {
        threads: [
          { id: 'thread-latest', updatedAt: 300 },
          { id: 'thread-old', updatedAt: 100 },
        ],
      }
    })

    let id = await listLatestCustomerThread(agent, 'user-42')

    assert.equal(id, 'thread-latest', 'should return the newest thread for the resource')
    assert.equal(captured?.filter?.resourceId, 'user-42', 'should scope the query to the resource')
    assert.equal(captured?.page, 0)
    assert.equal(captured?.perPage, 1)
    assert.equal(captured?.orderBy?.field, 'updatedAt')
    assert.equal(captured?.orderBy?.direction, 'DESC')
  })

  it('returns null when the resource has no threads', async () => {
    let agent = makeListAgent(() => ({ threads: [] }))
    let id = await listLatestCustomerThread(agent, 'user-7')
    assert.equal(id, null)
  })

  it('propagates a missing-memory error (caller degrades to empty resume)', async () => {
    let agent = { getMemory: async () => null }
    let threw = false
    try {
      await listLatestCustomerThread(agent, 'user-1')
    } catch {
      threw = true
    }
    assert.equal(threw, true, 'should throw when memory is unavailable')
  })
})

// ---------------------------------------------------------------------------
// Thread summaries for chatlog source classification and the chat entry contract
// listChatThreads/getChatThread/listAllChatThreads feed the derived source label,
// ownership check, and bounded sweep. They all normalise a stored thread to a
// numeric-timestamp summary carrying its owning resourceId.
// ---------------------------------------------------------------------------

interface RawThread {
  id: string
  resourceId: string
  createdAt: Date
  updatedAt: Date
}

function makeThreads(count: number, resourceId = '1'): RawThread[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `thread-${i}`,
    resourceId,
    createdAt: new Date(1_000 + i),
    updatedAt: new Date(2_000 + i),
  }))
}

function makeThreadMemory(threads: RawThread[]) {
  return {
    recall: async () => ({ messages: [], total: 0 }),
    listThreads: async ({ page, perPage }: { page: number; perPage: number }) => ({
      threads: threads.slice(page * perPage, page * perPage + perPage),
    }),
    getThreadById: async ({ threadId }: { threadId: string }) =>
      threads.find((thread) => thread.id === threadId) ?? null,
    deleteThread: async () => {},
  }
}

function makeThreadAgent(memory: unknown) {
  return { getMemory: async () => memory }
}

describe('mastra-memory thread summaries', () => {
  it('listChatThreads carries the owning resource and pagination', async () => {
    let memory = makeThreadMemory(makeThreads(3))
    let result = await listChatThreads(makeThreadAgent(memory), { page: 0, perPage: 2 })

    assert.equal(result.threads.length, 2)
    assert.equal(result.hasMore, true)
    assert.equal(result.threads[0]!.id, 'thread-0')
    assert.equal(result.threads[0]!.resourceId, '1')
    assert.equal(typeof result.threads[0]!.createdAt, 'number')
  })

  it('listAllChatThreads sweeps pages until a short page ends the sweep', async () => {
    let all = await listAllChatThreads(makeThreadAgent(makeThreadMemory(makeThreads(250))))

    assert.equal(all.length, 250)
    assert.equal(all[249]!.id, 'thread-249')
  })

  it('listAllChatThreads stops at the configured bound', async () => {
    let all = await listAllChatThreads(makeThreadAgent(makeThreadMemory(makeThreads(250))), {
      maxThreads: 120,
    })
    assert.equal(all.length, 120)
  })

  it('getChatThread normalises a stored thread and returns null when missing', async () => {
    let memory = makeThreadMemory(makeThreads(2, '77'))

    let found = await getChatThread(makeThreadAgent(memory), 'thread-1')
    assert.ok(found)
    assert.equal(found!.id, 'thread-1')
    assert.equal(found!.resourceId, '77')
    assert.equal(found!.createdAt, new Date(1_001).getTime())

    let missing = await getChatThread(makeThreadAgent(memory), 'nope')
    assert.equal(missing, null)
  })

  it('messageCount comes from the same bounded recall as the preview', async () => {
    let recallCalls = 0
    let agent = {
      getMemory: async () => ({
        recall: async () => {
          recallCalls++
          return { messages: [{ role: 'user', content: 'Hallo' }], total: 7 }
        },
      }),
    }
    let previews = await fetchChatThreadPreviews(agent, ['a', 'b'])
    assert.equal(recallCalls, 2, 'one recall per thread')
    assert.equal(previews.get('a')?.messageCount, 7)
    assert.equal(previews.get('b')?.messageCount, 7)
  })
})
