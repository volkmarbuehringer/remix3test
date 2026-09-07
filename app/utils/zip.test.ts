import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { inflateRawSync } from 'node:zlib'
import { buildZipArchive } from './zip.ts'

// Minimal ZIP reader for tests: walks the end-of-central-directory record to
// the central directory, then each central header to locate and decompress its
// local file data. Kept intentionally small — it only needs to prove that
// buildZipArchive emits a standards-compliant archive.
function readZip(buffer: Buffer): Array<{
  name: string
  method: number
  crc: number
  compressed: Buffer
  uncompressedSize: number
}> {
  let eocd = buffer.length - 22
  assert.equal(buffer.readUInt32LE(eocd), 0x06054b50, 'end-of-central-directory signature')
  let count = buffer.readUInt16LE(eocd + 10)
  let centralOffset = buffer.readUInt32LE(eocd + 16)

  let entries: Array<{
    name: string
    method: number
    crc: number
    compressed: Buffer
    uncompressedSize: number
  }> = []
  let pos = centralOffset
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(pos), 0x02014b50, 'central directory signature')
    let method = buffer.readUInt16LE(pos + 10)
    let crc = buffer.readUInt32LE(pos + 16)
    let compSize = buffer.readUInt32LE(pos + 20)
    let uncompSize = buffer.readUInt32LE(pos + 24)
    let nameLen = buffer.readUInt16LE(pos + 28)
    let extraLen = buffer.readUInt16LE(pos + 30)
    let commentLen = buffer.readUInt16LE(pos + 32)
    let localOffset = buffer.readUInt32LE(pos + 42)
    let name = buffer.toString('utf8', pos + 46, pos + 46 + nameLen)

    assert.equal(buffer.readUInt32LE(localOffset), 0x04034b50, 'local file header signature')
    let localNameLen = buffer.readUInt16LE(localOffset + 26)
    let localExtraLen = buffer.readUInt16LE(localOffset + 28)
    let dataStart = localOffset + 30 + localNameLen + localExtraLen
    let compressed = buffer.subarray(dataStart, dataStart + compSize)

    entries.push({ name, method, crc, compressed, uncompressedSize: uncompSize })
    pos += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function decompress(entry: { method: number; compressed: Buffer }): Buffer {
  if (entry.method === 0) return Buffer.from(entry.compressed)
  assert.equal(entry.method, 8, 'expected deflate compression')
  return inflateRawSync(entry.compressed)
}

describe('buildZipArchive', () => {
  it('produces a valid empty archive', () => {
    let buffer = buildZipArchive([])
    let entries = readZip(buffer)
    assert.equal(entries.length, 0)
    assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50)
  })

  it('stores a single entry with matching name, size, and content', () => {
    let buffer = buildZipArchive([{ filename: 'hello.txt', data: Buffer.from('hello world') }])
    let entries = readZip(buffer)
    assert.equal(entries.length, 1)
    assert.equal(entries[0]!.name, 'hello.txt')
    assert.equal(entries[0]!.uncompressedSize, 11)
    assert.equal(decompress(entries[0]!).toString('utf8'), 'hello world')
  })

  it('stores multiple entries in order', () => {
    let buffer = buildZipArchive([
      { filename: 'a.txt', data: Buffer.from('aaa') },
      { filename: 'b.txt', data: Buffer.from('bbb') },
      { filename: 'c.txt', data: Buffer.from('ccc') },
    ])
    let entries = readZip(buffer)
    assert.deepEqual(
      entries.map((e) => e.name),
      ['a.txt', 'b.txt', 'c.txt'],
    )
    assert.equal(decompress(entries[0]!).toString('utf8'), 'aaa')
    assert.equal(decompress(entries[1]!).toString('utf8'), 'bbb')
    assert.equal(decompress(entries[2]!).toString('utf8'), 'ccc')
  })

  it('stores binary data round-trip', () => {
    let payload = Buffer.from([0, 1, 2, 3, 255, 254, 128, 42])
    let buffer = buildZipArchive([{ filename: 'bin.dat', data: payload }])
    let entries = readZip(buffer)
    assert.deepEqual(decompress(entries[0]!), payload)
  })

  it('preserves non-ASCII filenames as UTF-8', () => {
    let buffer = buildZipArchive([{ filename: 'grüße-übung.txt', data: Buffer.from('x') }])
    let entries = readZip(buffer)
    assert.equal(entries[0]!.name, 'grüße-übung.txt')
  })

  it('deflate compresses repetitive content', () => {
    let data = Buffer.from('abcdefgh'.repeat(1000))
    let buffer = buildZipArchive([{ filename: 'repeat.txt', data }])
    let entries = readZip(buffer)
    assert.ok(entries[0]!.compressed.length < data.length, 'repetitive data should compress')
    assert.equal(decompress(entries[0]!).toString('utf8'), data.toString('utf8'))
  })
})
