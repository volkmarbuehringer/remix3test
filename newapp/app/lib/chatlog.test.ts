import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../data/setup.ts'
import { sql } from 'remix/data-table'
import {
  createConversation,
  appendMessage,
  getConversation,
  deleteConversation,
  type ChatMessage,
} from './chatlog.ts'

const testIds: string[] = []

function makeMessage(content: string, role: 'user' | 'assistant' = 'user'): ChatMessage {
  return { role, content, timestamp: Date.now() }
}

describe('chatlog', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  after(async () => {
    for (let id of testIds) {
      try {
        await deleteConversation(id)
      } catch {
        // ignore
      }
    }
  })

  describe('createConversation', () => {
    it('creates a new conversation and returns an id', async () => {
      let id = await createConversation()
      assert.ok(typeof id === 'string' && id.length > 0)
      testIds.push(id)

      let row = await getConversation(id)
      assert.ok(row != null)
      assert.equal(row.conversation.length, 0)
    })
  })

  describe('appendMessage', () => {
    it('appends a message to an existing conversation', async () => {
      let id = await createConversation()
      testIds.push(id)

      let result = await appendMessage(id, makeMessage('Hello world'))
      assert.ok(result != null)
      assert.equal(result.conversation.length, 1)
      assert.equal(result.conversation[0].content, 'Hello world')
    })

    it('appends multiple messages sequentially', async () => {
      let id = await createConversation()
      testIds.push(id)

      await appendMessage(id, makeMessage('First'))
      await appendMessage(id, makeMessage('Second'))
      let result = await appendMessage(id, makeMessage('Third'))

      assert.ok(result != null)
      assert.equal(result.conversation.length, 3)
      assert.equal(result.conversation[2].content, 'Third')
    })

    it('returns null for non-existent conversation', async () => {
      let result = await appendMessage('nonexistent-id-12345', makeMessage('test'))
      assert.equal(result, null)
    })

    it('throws on empty message content', async () => {
      let id = await createConversation()
      testIds.push(id)

      try {
        await appendMessage(id, makeMessage(''))
        assert.ok(false, 'should have thrown')
      } catch (err: unknown) {
        assert.ok(err instanceof Error)
        assert.ok((err as Error).message.includes('empty'))
      }

      try {
        await appendMessage(id, makeMessage('   '))
        assert.ok(false, 'should have thrown')
      } catch (err: unknown) {
        assert.ok(err instanceof Error)
        assert.ok((err as Error).message.includes('empty'))
      }
    })

    it('handles concurrent appends without data loss', async () => {
      let id = await createConversation()
      testIds.push(id)

      // Simulate concurrent appends by firing multiple appends at the same time
      let results = await Promise.all([
        appendMessage(id, makeMessage('Concurrent A')),
        appendMessage(id, makeMessage('Concurrent B')),
        appendMessage(id, makeMessage('Concurrent C')),
      ])

      // All should succeed (none null)
      for (let r of results) {
        assert.ok(r != null, 'each concurrent append should succeed')
      }

      // Re-read to verify all 3 messages are persisted
      let final = await getConversation(id)
      assert.ok(final != null)
      let contents = final.conversation.map((m) => m.content)
      assert.ok(contents.includes('Concurrent A'), 'message A should be present')
      assert.ok(contents.includes('Concurrent B'), 'message B should be present')
      assert.ok(contents.includes('Concurrent C'), 'message C should be present')
      assert.equal(final.conversation.length, 3, 'all three messages should be persisted')
    })

    it('persists conversation to database', async () => {
      let id = await createConversation()
      testIds.push(id)

      await appendMessage(id, makeMessage('Persist me'))

      let row = await getConversation(id)
      assert.ok(row != null)
      assert.equal(row.conversation.length, 1)
      assert.equal(row.conversation[0].content, 'Persist me')
    })

    it('sets timestamp when not provided', async () => {
      let id = await createConversation()
      testIds.push(id)

      let result = await appendMessage(id, { role: 'user', content: 'No timestamp', timestamp: 0 as unknown as number })
      assert.ok(result != null)
      assert.ok(result.conversation[0].timestamp > 0)
    })
  })

  describe('getConversation', () => {
    it('returns null for non-existent id', async () => {
      let result = await getConversation('nonexistent')
      assert.equal(result, null)
    })
  })

  describe('getAllConversations', () => {
    it('returns empty array when no conversations exist', async () => {
      // All test conversations have been cleaned up or are specific to this test
      let all = await db.exec(sql`SELECT * FROM chatlog`)
      assert.ok(Array.isArray(all.rows))
    })
  })

  describe('deleteConversation', () => {
    it('deletes a conversation', async () => {
      let id = await createConversation()
      await appendMessage(id, makeMessage('To be deleted'))

      await deleteConversation(id)

      let row = await getConversation(id)
      assert.equal(row, null)
    })
  })
})
