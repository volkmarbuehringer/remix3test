import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { refreshPinDocs } from './remix-pin-docs.ts'

const OLD_TAG = 'v0.20260101.1-main-aaaaaaaa'
const NEW_TAG = 'v0.20260102.1-main-bbbbbbbb'
const OLD_SOURCE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const NEW_SOURCE = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

const roots: string[] = []

function fixture(files: Record<string, string>): string {
  let root = fs.mkdtempSync(path.join(import.meta.dirname, '..', 'tmp', 'pin-docs-'))
  roots.push(root)
  for (let [name, content] of Object.entries(files)) {
    let file = path.join(root, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return root
}

afterEach(() => {
  for (let root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

const change = {
  oldTag: OLD_TAG,
  oldSource: OLD_SOURCE,
  newTag: NEW_TAG,
  newSource: NEW_SOURCE,
}

describe('refreshPinDocs', () => {
  it('rewrites current-pin strings and leaves historical statements alone', () => {
    let learned = '.opencode/skills/learned/example.md'
    let root = fixture({
      [learned]: [
        'Revalidated: preview release `' + OLD_TAG + '` / source `aaaaaaaa`.',
        'Since preview build `aaaaaaaa` (#1) stays put.',
        'The example URL uses ' + OLD_TAG + '.',
        'Since remix #12203 (pin `aaaaaaaa`) stays put.',
      ].join('\n'),
      'AGENTS.md':
        'The pin is release `' +
        OLD_TAG +
        '` (source `aaaaaaaa`); This bump (`aaaaaaaa` → `bbbbbbbb`) is history.\n',
    })

    let result = refreshPinDocs(root, change)

    assert.deepEqual(result.updated, [learned, 'AGENTS.md'])
    assert.deepEqual(result.skipped, [learned + ':2', learned + ':4'])

    let learnedText = fs.readFileSync(path.join(root, learned), 'utf8')
    assert.ok(learnedText.includes(NEW_TAG), 'tag refreshed')
    assert.ok(learnedText.includes('source `bbbbbbbb`'), 'source refreshed')
    assert.ok(
      learnedText.includes('Since preview build `aaaaaaaa` (#1) stays put.'),
      'history kept',
    )
    assert.ok(
      learnedText.includes('Since remix #12203 (pin `aaaaaaaa`) stays put.'),
      'issue history kept',
    )

    let agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
    assert.ok(
      agents.includes('release `' + NEW_TAG + '` (source `bbbbbbbb`)'),
      'AGENTS pin refreshed',
    )
    assert.ok(
      agents.includes('This bump (`aaaaaaaa` → `bbbbbbbb`) is history.'),
      'AGENTS history kept',
    )
  })

  it('is idempotent once the pin strings are at the target', () => {
    let root = fixture({
      '.opencode/skills/learned/example.md':
        'preview release `' + OLD_TAG + '` / source `aaaaaaaa`\n',
    })
    assert.deepEqual(refreshPinDocs(root, change).updated, ['.opencode/skills/learned/example.md'])
    assert.deepEqual(refreshPinDocs(root, change).updated, [])
  })

  it('reports without writing in dry-run mode', () => {
    let learned = '.opencode/skills/learned/example.md'
    let original = 'preview release `' + OLD_TAG + '` / source `aaaaaaaa`\n'
    let root = fixture({ [learned]: original })

    let result = refreshPinDocs(root, change, { dryRun: true })

    assert.deepEqual(result.updated, [learned])
    assert.equal(fs.readFileSync(path.join(root, learned), 'utf8'), original)
  })
})
