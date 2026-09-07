import { deflateRawSync } from 'node:zlib'

export interface ZipEntry {
  filename: string
  data: Buffer
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50

// General purpose bit 11 marks the filename/comment as UTF-8.
const UTF8_FLAG = 0x0800
const DEFLATE_METHOD = 8
const DOS_TIME = 0
// 1980-01-01 — the earliest representable DOS date; uploads store no timestamp.
const DOS_DATE = 0x0021

const CRC_TABLE = (() => {
  let table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Build a ZIP archive (deflate-compressed entries) from the given files using
 * only Node's built-in `zlib` — no third-party dependency. Produces a minimal
 * but standards-compliant archive: a local file header + compressed data per
 * entry, one central directory, and an end-of-central-directory record. Entry
 * filenames are stored as UTF-8 (bit 11 set) so non-ASCII names survive.
 */
export function buildZipArchive(entries: ZipEntry[]): Buffer {
  let localParts: Buffer[] = []
  let centralParts: Buffer[] = []
  let offset = 0

  for (let entry of entries) {
    let filename = Buffer.from(entry.filename, 'utf8')
    let compressed = deflateRawSync(entry.data)
    let crc = crc32(entry.data)

    let localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0)
    localHeader.writeUInt16LE(20, 4) // version needed to extract
    localHeader.writeUInt16LE(UTF8_FLAG, 6)
    localHeader.writeUInt16LE(DEFLATE_METHOD, 8)
    localHeader.writeUInt16LE(DOS_TIME, 10)
    localHeader.writeUInt16LE(DOS_DATE, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(entry.data.length, 22)
    localHeader.writeUInt16LE(filename.length, 26)
    localHeader.writeUInt16LE(0, 28) // extra field length
    localParts.push(localHeader, filename, compressed)

    let centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0)
    centralHeader.writeUInt16LE(0x031e, 4) // version made by (Unix, 3.0)
    centralHeader.writeUInt16LE(20, 6) // version needed to extract
    centralHeader.writeUInt16LE(UTF8_FLAG, 8)
    centralHeader.writeUInt16LE(DEFLATE_METHOD, 10)
    centralHeader.writeUInt16LE(DOS_TIME, 12)
    centralHeader.writeUInt16LE(DOS_DATE, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(compressed.length, 20)
    centralHeader.writeUInt32LE(entry.data.length, 24)
    centralHeader.writeUInt16LE(filename.length, 28)
    centralHeader.writeUInt16LE(0, 30) // extra field length
    centralHeader.writeUInt16LE(0, 32) // file comment length
    centralHeader.writeUInt16LE(0, 34) // disk number start
    centralHeader.writeUInt16LE(0, 36) // internal file attributes
    centralHeader.writeUInt32LE(0, 38) // external file attributes
    centralHeader.writeUInt32LE(offset, 42) // local header offset
    centralParts.push(centralHeader, filename)

    offset += localHeader.length + filename.length + compressed.length
  }

  let centralDirectory = Buffer.concat(centralParts)
  let centralOffset = offset

  let endRecord = Buffer.alloc(22)
  endRecord.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0)
  endRecord.writeUInt16LE(0, 4) // disk number
  endRecord.writeUInt16LE(0, 6) // disk with central directory
  endRecord.writeUInt16LE(entries.length, 8) // entries on this disk
  endRecord.writeUInt16LE(entries.length, 10) // total entries
  endRecord.writeUInt32LE(centralDirectory.length, 12)
  endRecord.writeUInt32LE(centralOffset, 16)
  endRecord.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...localParts, centralDirectory, endRecord])
}
