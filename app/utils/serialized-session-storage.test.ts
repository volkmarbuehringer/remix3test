import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { Session, SessionStorage } from 'remix/session'

import { serializeSessionStorage } from './serialized-session-storage.ts'

describe('serializeSessionStorage', () => {
  it('waits for an in-flight save before reading the same session', async () => {
    let releaseWrite!: () => void
    let writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve
    })
    let writing = false
    let stored: Record<string, unknown> = {}
    let storage = {
      async read(cookie: string | null) {
        // The fs store's in-place write leaves an empty file visible to a
        // concurrent read; JSON.parse then throws this exact error.
        if (writing) throw new SyntaxError('Unexpected end of JSON input')
        return { id: cookie ?? 'new', data: stored }
      },
      async save(session: { id: string; data: Record<string, unknown> }) {
        writing = true
        await writeGate
        stored = session.data
        writing = false
        return session.id
      },
    }
    let serialized = serializeSessionStorage(storage as unknown as SessionStorage)
    let session = { id: 'session-1', data: { user: 1 } } as unknown as Session

    let save = serialized.save(session)
    let read = serialized.read('session-1')
    let readSettled = false
    void read.then(() => {
      readSettled = true
    })
    await Promise.resolve()
    assert.equal(readSettled, false, 'the read should wait for the save')

    releaseWrite()
    await save
    let loaded = (await read) as unknown as { data: Record<string, unknown> }
    assert.deepEqual(loaded.data, { user: 1 })
  })
})
