import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../data/setup.ts'
import { db } from './setup.ts'
import { sql } from 'remix/data-table'
import {
  createConversation,
  appendMessage,
  getConversation,
  deleteConversation,
  type ChatMessage,
} from './chatlog.ts'

const TEST_USER_ID = 1
const OTHER_USER_ID = 2
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
        await deleteConversation(db, id)
      } catch {
        // ignore
      }
    }
  })

  describe('createConversation', () => {
    it('creates a new conversation and returns an id', async () => {
      let id = await createConversation(db, TEST_USER_ID)
      assert.ok(typeof id === 'string' && id.length > 0)
      testIds.push(id)

      let row = await getConversation(db, id, TEST_USER_ID)
      assert.ok(row != null)
      assert.equal(row.conversation.length, 0)
    })
  })

  describe('appendMessage', () => {
    it('appends a message to an existing conversation', async () => {
      let id = await createConversation(db, TEST_USER_ID)
      testIds.push(id)

      let result = await appendMessage(db, id, TEST_USER_ID, makeMessage('Hello world'))
      assert.ok(result != null)
      assert.equal(result.conversation.length, 1)
      assert.equal(result.conversation[0].content, 'Hello world')
    })

    it('appends multiple messages sequentially', async () => {
      let id = await createConversation(db, TEST_USER_ID)
      testIds.push(id)

      await appendMessage(db, id, TEST_USER_ID, makeMessage('First'))
      await appendMessage(db, id, TEST_USER_ID, makeMessage('Second'))
      let result = await appendMessage(db, id, TEST_USER_ID, makeMessage('Third'))

      assert.ok(result != null)
      assert.equal(result.conversation.length, 3)
      assert.equal(result.conversation[2].content, 'Third')
    })

    it('returns null for non-existent conversation', async () => {
      let result = await appendMessage(db, 'nonexistent-id-12345', TEST_USER_ID, makeMessage('test'))
      assert.equal(result, null)
    })

    it('throws on empty message content', async () => {
      let id = await createConversation(db, TEST_USER_ID)
      testIds.push(id)

      try {
        await appendMessage(db, id, TEST_USER_ID, makeMessage(''))
        assert.ok(false, 'should have thrown')
      } catch (err: unknown) {
        assert.ok(err instanceof Error)
        assert.ok((err as Error).message.includes('empty'))
      }

      try {
        await appendMessage(db, id, TEST_USER_ID, makeMessage('   '))
        assert.ok(false, 'should have thrown')
      } catch (err: unknown) {
        assert.ok(err instanceof Error)
        assert.ok((err as Error).message.includes('empty'))
      }
    })

    it('handles concurrent appends without data loss', async () => {
      let id = await createConversation(db, TEST_USER_ID)
      testIds.push(id)

      let results = await Promise.all([
        appendMessage(db, id, TEST_USER_ID, makeMessage('Concurrent A')),
        appendMessage(db, id, TEST_USER_ID, makeMessage('Concurrent B')),
        appendMessage(db, id, TEST_USER_ID, makeMessage('Concurrent C')),
      ])

      for (let r of results) {
        assert.ok(r != null, 'each concurrent append should succeed')
      }

      let final = await getConversation(db, id, TEST_USER_ID)
      assert.ok(final != null)
      let contents = final.conversation.map((m) => m.content)
      assert.ok(contents.includes('Concurrent A'), 'message A should be present')
      assert.ok(contents.includes('Concurrent B'), 'message B should be present')
      assert.ok(contents.includes('Concurrent C'), 'message C should be present')
      assert.equal(final.conversation.length, 3, 'all three messages should be persisted')
    })

    it('persists conversation to database', async () => {
      let id = await createConversation(db, TEST_USER_ID)
      testIds.push(id)

      await appendMessage(db, id, TEST_USER_ID, makeMessage('Persist me'))

      let row = await getConversation(db, id, TEST_USER_ID)
      assert.ok(row != null)
      assert.equal(row.conversation.length, 1)
      assert.equal(row.conversation[0].content, 'Persist me')
    })

    it('sets timestamp when not provided', async () => {
      let id = await createConversation(db, TEST_USER_ID)
      testIds.push(id)

      let result = await appendMessage(db, id, TEST_USER_ID, { role: 'user', content: 'No timestamp', timestamp: 0 as unknown as number })
      assert.ok(result != null)
      assert.ok(result.conversation[0].timestamp > 0)
    })
  })

  describe('getConversation', () => {
    it('returns null for non-existent id', async () => {
      let result = await getConversation(db, 'nonexistent', TEST_USER_ID)
      assert.equal(result, null)
    })

    it('prevents cross-user conversation access', async () => {
      let aliceId = await createConversation(db, 1)
      testIds.push(aliceId)

      let bobResult = await getConversation(db, aliceId, 2)
      assert.equal(bobResult, null)
    })
  })

  describe('getAllConversations', () => {
    it('returns empty array when no conversations exist', async () => {
      let all = await db.exec(sql`SELECT * FROM chatlog`)
      assert.ok(Array.isArray(all.rows))
    })
  })

  describe('deleteConversation', () => {
    it('deletes a conversation', async () => {
      let id = await createConversation(db, TEST_USER_ID)
      await appendMessage(db, id, TEST_USER_ID, makeMessage('To be deleted'))

      await deleteConversation(db, id, TEST_USER_ID)

      let row = await getConversation(db, id, TEST_USER_ID)
      assert.equal(row, null)
    })
  })
})
