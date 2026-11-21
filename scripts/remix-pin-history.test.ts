import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  buildPinHistoryRow,
  formatPinHistoryEntry,
  hasPinHistoryEntry,
  insertPinHistoryEntry,
  insertPinHistoryRow,
  type PinHistoryEntry,
} from './remix-pin-history.ts'

const args: PinHistoryEntry = {
  date: '2026-11-21',
  oldTag: 'v0.0.20261120-main-01e5b5d4',
  oldSource: '01e5b5d4c1d0',
  targetTag: 'v0.0.20261120-main-275f353c',
  targetSource: '275f353cbf94',
  subjects: ['#12350 WebKit history-quota recovery', '#12373 data-schema output keys'],
  refs: 278,
  versions: '`remix` 3.3.0, `@remix-run/ui` 0.14.0',
  tests: 'server 192 files, all green',
}

describe('pin history writer', () => {
  it('formats the mechanical entry with TODO editorial bullets', () => {
    let entry = formatPinHistoryEntry(args)

    assert.ok(
      entry.startsWith(
        '**Bump recorded 2026-11-21: preview release `v0.0.20261120-main-01e5b5d4`/source `01e5b5d4` → `v0.0.20261120-main-275f353c`/source `275f353c` (2 commits: #12350 WebKit history-quota recovery; #12373 data-schema output keys).**',
      ),
    )
    assert.ok(entry.includes('- **Lock:** all 278 release-tarball refs resolve to'))
    assert.ok(entry.includes('- **Versions:** `remix` 3.3.0'))
    assert.ok(entry.includes('- **Package delta:** TODO'))
    assert.ok(entry.includes('- **Verification (2026-11-21):** server 192 files'))
  })

  it('builds a newest-first table row from the commit subjects', () => {
    assert.equal(
      buildPinHistoryRow(args),
      '| 2026-11-21 | `v0.0.20261120-main-275f353c` | `275f353c` | #12350 WebKit history-quota recovery; #12373 data-schema output keys |',
    )
  })

  it('escapes table separators in commit subjects', () => {
    let row = buildPinHistoryRow({ ...args, subjects: ['a | b'] })

    assert.equal(row, '| 2026-11-21 | `v0.0.20261120-main-275f353c` | `275f353c` | a \\| b |')
  })

  it('detects an existing entry for the target tag', () => {
    assert.equal(
      hasPinHistoryEntry('→ `v0.0.20261120-main-275f353c`/source `275f353c`', args.targetTag),
      true,
    )
    assert.equal(
      hasPinHistoryEntry('→ `v0.0.20261119-main-9e4da4d3`/source `9e4da4d3`', args.targetTag),
      false,
    )
  })

  it('inserts the entry before the newest-first marker and keeps existing text', () => {
    let doc = '# History\n\nOld entry.\n\n**Pin history (newest first).**\n\n| Recorded | Build |\n'
    let next = insertPinHistoryEntry(doc, formatPinHistoryEntry(args))

    assert.ok(next.startsWith('# History\n\nOld entry.'))
    assert.ok(next.includes('**Bump recorded 2026-11-21:'))
    assert.ok(next.indexOf('**Bump recorded') < next.indexOf('**Pin history (newest first).**'))
  })

  it('inserts the row directly below the table header', () => {
    let doc = [
      '| Recorded | Build | Source | Range highlights |',
      '| -------- | ----- | ------ | ---------------- |',
      '| 2026-11-20 | old | old | old |',
    ].join('\n')
    let next = insertPinHistoryRow(doc, buildPinHistoryRow(args))

    assert.deepEqual(next.split('\n').slice(0, 4), [
      '| Recorded | Build | Source | Range highlights |',
      '| -------- | ----- | ------ | ---------------- |',
      '| 2026-11-21 | `v0.0.20261120-main-275f353c` | `275f353c` | #12350 WebKit history-quota recovery; #12373 data-schema output keys |',
      '| 2026-11-20 | old | old | old |',
    ])
  })
})
