import * as assert from 'remix/assert'
import { createSession, type Session, type SessionStorage } from 'remix/session'
import { describe, it } from 'remix/test'

import { mergeSessionWrites } from './session-storage-merge.ts'

type SessionData = Session['data']

const flashKeys = ['success', 'error'] as const

describe('mergeSessionWrites', () => {
  it('keeps values written by overlapping requests', async () => {
    let { storage, files } = createFakeStorage()
    let merged = mergeSessionWrites(storage, { flashKeys })
    let cookie = await seed(merged, (session) => session.set('pageSize', 25))

    let first = await merged.read(cookie)
    let second = await merged.read(cookie)
    first.set('theme', 'dark')
    second.set('pageSize', 50)

    await merged.save(first)
    await merged.save(second)

    assert.deepEqual(files.get(cookie)?.[0], { pageSize: 50, theme: 'dark' })
  })

  it("applies a deletion without dropping another request's key", async () => {
    let { storage, files } = createFakeStorage()
    let merged = mergeSessionWrites(storage, { flashKeys })
    let cookie = await seed(merged, (session) => {
      session.set('theme', 'dark')
      session.set('pageSize', 25)
    })

    let deleting = await merged.read(cookie)
    let adding = await merged.read(cookie)
    deleting.unset('theme')
    adding.set('pageSize', 50)

    await merged.save(deleting)
    await merged.save(adding)

    assert.deepEqual(files.get(cookie)?.[0], { pageSize: 50 })
  })

  it('does not clear a flash another request wrote meanwhile', async () => {
    let { storage, files } = createFakeStorage()
    let merged = mergeSessionWrites(storage, { flashKeys })
    let cookie = await seed(merged, (session) => session.flash('success', 'saved'))

    let reader = await merged.read(cookie)
    let writer = await merged.read(cookie)
    writer.flash('error', 'failed')

    await merged.save(writer)
    await merged.save(reader)

    assert.deepEqual(files.get(cookie)?.[1], { error: 'failed' })
  })

  it('clears a flash this request consumed', async () => {
    let { storage, files } = createFakeStorage()
    let merged = mergeSessionWrites(storage, { flashKeys })
    let cookie = await seed(merged, (session) => session.flash('success', 'saved'))

    let reader = await merged.read(cookie)
    await merged.save(reader)

    assert.deepEqual(files.get(cookie)?.[1], {})
  })

  it('ignores sessions it did not read', async () => {
    let { storage, files } = createFakeStorage()
    let merged = mergeSessionWrites(storage, { flashKeys })
    let direct = createSession()
    direct.set('pageSize', 10)

    let cookie = await merged.save(direct)

    assert.ok(cookie)
    assert.deepEqual(files.get(cookie)?.[0], { pageSize: 10 })
  })
})

async function seed(storage: SessionStorage, mutate: (session: Session) => void): Promise<string> {
  let session = await storage.read(null)
  mutate(session)
  let cookie = await storage.save(session)
  assert.ok(cookie)
  return cookie
}

function createFakeStorage(): { storage: SessionStorage; files: Map<string, SessionData> } {
  let files = new Map<string, SessionData>()

  return {
    files,
    storage: {
      async read(cookie) {
        let data = cookie ? files.get(cookie) : undefined
        return data ? createSession(cookie!, structuredClone(data)) : createSession()
      },
      async save(session) {
        if (session.deleteId) files.delete(session.deleteId)
        if (session.destroyed) {
          files.delete(session.id)
          return ''
        }
        if (!session.dirty) return null

        files.set(session.id, structuredClone(session.data))
        return session.id
      },
    },
  }
}
