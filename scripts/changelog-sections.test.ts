import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  changelogHighlights,
  newChangelogSections,
  parseChangelogSections,
} from './changelog-sections.ts'

const SAMPLE = `# \`data-table\` CHANGELOG

This is the changelog. It follows semantic versioning.

## v1.2.0

### Major Changes

- Removed the old helper.

### Patch Changes

- Fixed \`ANY\` binding.

### Docs

- Not a change entry.

## v1.1.0

### Minor Changes

- \`sql\` expands arrays, and \`column.json()\` serializes strings.

  Passing pre-serialized text now stores a string.

### Patch Changes

- Same-copy fragments only.

## v1.0.0

### Patch Changes

- Older entry.
`

describe('changelog-sections', () => {
  it('parses newest-first version sections and ignores preamble prose', () => {
    let sections = parseChangelogSections(SAMPLE)
    assert.deepEqual(
      sections.map((section) => section.version),
      ['1.2.0', '1.1.0', '1.0.0'],
    )
    assert.ok(sections[0]?.body.includes('Fixed `ANY` binding.'))
  })

  it('returns only the sections above the installed version', () => {
    assert.deepEqual(
      newChangelogSections(SAMPLE, '1.0.0').map((section) => section.version),
      ['1.2.0', '1.1.0'],
    )
    assert.deepEqual(
      newChangelogSections(SAMPLE, '1.1.0').map((section) => section.version),
      ['1.2.0'],
    )
    assert.deepEqual(newChangelogSections(SAMPLE, '1.2.0'), [])
  })

  it('falls back to the newest section when the installed version is unknown', () => {
    assert.deepEqual(
      newChangelogSections(SAMPLE, '0.9.0').map((section) => section.version),
      ['1.2.0'],
    )
    assert.deepEqual(
      newChangelogSections(SAMPLE, undefined).map((section) => section.version),
      ['1.2.0'],
    )
  })

  it('keeps Major, Minor, and Patch blocks and drops unrelated subsections', () => {
    let highlights = changelogHighlights(parseChangelogSections(SAMPLE)[0]!.body)
    assert.ok(highlights.includes('### Major Changes'))
    assert.ok(highlights.includes('Removed the old helper.'))
    assert.ok(highlights.includes('### Patch Changes'))
    assert.ok(highlights.includes('Fixed `ANY` binding.'))
    assert.ok(!highlights.includes('### Docs'))
    assert.ok(!highlights.includes('Not a change entry.'))
  })

  it('keeps the prose under a change bullet', () => {
    let highlights = changelogHighlights(parseChangelogSections(SAMPLE)[1]!.body)
    assert.ok(highlights.includes('### Minor Changes'))
    assert.ok(highlights.includes('Passing pre-serialized text now stores a string.'))
  })

  it('handles CRLF changelogs', () => {
    let sections = parseChangelogSections(SAMPLE.replace(/\n/g, '\r\n'))
    assert.deepEqual(
      sections.map((section) => section.version),
      ['1.2.0', '1.1.0', '1.0.0'],
    )
    assert.ok(changelogHighlights(sections[0]!.body).includes('Fixed `ANY` binding.'))
  })
})
