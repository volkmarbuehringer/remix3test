import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { uploadFiles, uploadFilesDirectory } from './storage.ts'

/** A File whose body publishes one chunk and then fails like a dropped upload. */
function interruptedFile(name: string): File {
  let sent = false
  return {
    name,
    type: 'text/plain',
    lastModified: Date.now(),
    size: 7,
    stream() {
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!sent) {
            sent = true
            controller.enqueue(new TextEncoder().encode('partial'))
            return
          }
          controller.error(new Error('simulated interrupted upload'))
        },
      })
    },
  } as unknown as File
}

async function hashOf(key: string): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Buffer.from(digest).toString('hex')
}

async function storagePaths(key: string) {
  let hash = await hashOf(key)
  let directory = path.join(uploadFilesDirectory, hash.slice(0, 2))
  return {
    hash,
    directory,
    data: path.join(directory, `${hash}.dat`),
    meta: path.join(directory, `${hash}.meta.json`),
  }
}

async function rejectInterruptedWrite(key: string): Promise<void> {
  let rejected = false
  try {
    await uploadFiles.set(key, interruptedFile('interrupted.txt'))
  } catch (error) {
    assert.ok(error instanceof Error, 'the stream error should surface')
    rejected = true
  }
  assert.equal(rejected, true, 'the interrupted write must reject')
}

describe('staged filesystem uploads', () => {
  it('keeps the published version when a replacement is interrupted', async () => {
    let key = `upload-staging-${crypto.randomUUID()}`
    try {
      await uploadFiles.set(
        key,
        new File(['complete original'], 'original.txt', { type: 'text/plain' }),
      )
      await rejectInterruptedWrite(key)

      let stored = await uploadFiles.get(key)
      assert.ok(stored, 'the previous version must still be readable')
      assert.equal(await stored.text(), 'complete original', 'no partial bytes may be published')
    } finally {
      await Promise.resolve(uploadFiles.remove(key)).catch(() => {})
    }
  })

  it('publishes nothing and cleans staging files for a new interrupted key', async () => {
    let key = `upload-staging-${crypto.randomUUID()}`
    let paths = await storagePaths(key)
    try {
      await rejectInterruptedWrite(key)

      assert.equal(await uploadFiles.get(key), null, 'nothing is published for the new key')
      let entries = await fsp.readdir(paths.directory).catch(() => [] as string[])
      assert.deepEqual(
        entries.filter((entry) => entry.startsWith(`${paths.hash}.`)),
        [],
        'neither .dat/.meta.json nor .upload staging files remain',
      )
    } finally {
      await Promise.resolve(uploadFiles.remove(key)).catch(() => {})
    }
  })
})
