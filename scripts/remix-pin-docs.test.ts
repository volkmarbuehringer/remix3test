import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  checkAgentsDoc,
  checkAnalysisDoc,
  compareAnalysisDoc,
  readAnalysisExpectation,
  refreshPinDocs,
  type AnalysisExpectation,
} from './remix-pin-docs.ts'

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
  commits: 4,
}

describe('refreshPinDocs', () => {
  it('rewrites current-pin strings and leaves historical statements alone', () => {
    let learned = '.opencode/skills/learned/example.md'
    let root = fixture({
      [learned]: [
        'Revalidated: preview release `' + OLD_TAG + '` / source `aaaaaaaa`.',
        'Since preview build `aaaaaaaa` (#1) stays put.',
        'The example URL uses ' + OLD_TAG + '.',
        'Current pin: `cccccccc` → `aaaaaaaa` (3 commits).',
        'Current range summary: hand-authored.',
        'Since remix #12203 (pin `aaaaaaaa`) stays put.',
        'Re-validated (2026-11-12): against preview release `' + OLD_TAG + '` / source `aaaaaaaa`.',
        '**Validated:** re-checked against preview release `' + OLD_TAG + '` / source `aaaaaaaa`.',
        'Since the `' + OLD_TAG + '` pin the app delegates.',
        'Since #12183 (pin `' + OLD_TAG + '`) is history.',
        'A fix landed since #12290 (preview `' + OLD_TAG + '`).',
        'Only applies on a pin older than `' + OLD_SOURCE + '`.',
      ].join('\n'),
      'AGENTS.md':
        'The pin is release `' +
        OLD_TAG +
        '` (source `aaaaaaaa`); This bump (`aaaaaaaa` → `bbbbbbbb`) is history.\n',
    })

    let result = refreshPinDocs(root, change)

    assert.deepEqual(result.updated, [learned, 'AGENTS.md'])
    assert.deepEqual(result.skipped, [
      learned + ':1',
      learned + ':2',
      learned + ':6',
      learned + ':7',
      learned + ':8',
      learned + ':9',
      learned + ':10',
      learned + ':11',
      learned + ':12',
    ])

    let learnedText = fs.readFileSync(path.join(root, learned), 'utf8')
    assert.ok(learnedText.includes(NEW_TAG), 'tag refreshed')
    assert.ok(learnedText.includes('→ `bbbbbbbb`'), 'source refreshed')
    assert.ok(
      learnedText.includes('Current pin: `aaaaaaaa` → `bbbbbbbb` (4 commits).'),
      'mechanical pin line refreshed',
    )
    assert.ok(
      learnedText.includes('Revalidated: preview release `' + OLD_TAG + '` / source `aaaaaaaa`.'),
      'revalidation history kept',
    )
    assert.ok(
      learnedText.includes('Since preview build `aaaaaaaa` (#1) stays put.'),
      'history kept',
    )
    assert.ok(
      learnedText.includes('Since remix #12203 (pin `aaaaaaaa`) stays put.'),
      'issue history kept',
    )
    assert.ok(
      learnedText.includes(
        'Re-validated (2026-11-12): against preview release `' + OLD_TAG + '` / source `aaaaaaaa`.',
      ),
      'hyphenated revalidation history kept',
    )
    assert.ok(
      learnedText.includes(
        '**Validated:** re-checked against preview release `' + OLD_TAG + '` / source `aaaaaaaa`.',
      ),
      'validated header history kept',
    )
    assert.ok(
      learnedText.includes('Since the `' + OLD_TAG + '` pin the app delegates.'),
      'adoption-time pin kept',
    )
    assert.ok(
      learnedText.includes('Since #12183 (pin `' + OLD_TAG + '`) is history.'),
      'issue pin kept',
    )
    assert.ok(
      learnedText.includes('A fix landed since #12290 (preview `' + OLD_TAG + '`).'),
      'mid-sentence preview history kept',
    )
    assert.ok(
      learnedText.includes('Only applies on a pin older than `' + OLD_SOURCE + '`.'),
      'older-than history kept',
    )
    assert.ok(
      learnedText.includes('Current range summary: hand-authored.'),
      'hand-authored summary kept',
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

  it('rewrites the mechanical pin line idempotently', () => {
    let learned = '.opencode/skills/learned/example.md'
    let root = fixture({
      [learned]: 'Current pin: `cccccccc` → `aaaaaaaa` (3 commits).\n',
    })

    assert.deepEqual(refreshPinDocs(root, change).updated, [learned])
    assert.equal(
      fs.readFileSync(path.join(root, learned), 'utf8'),
      'Current pin: `aaaaaaaa` → `bbbbbbbb` (4 commits).\n',
    )
    assert.deepEqual(refreshPinDocs(root, change).updated, [])
  })

  it('is idempotent once the pin strings are at the target', () => {
    let root = fixture({
      '.opencode/skills/learned/example.md':
        'preview release `' + OLD_TAG + '` / source `aaaaaaaa`\n',
    })
    assert.deepEqual(refreshPinDocs(root, change).updated, ['.opencode/skills/learned/example.md'])
    assert.deepEqual(refreshPinDocs(root, change).updated, [])
  })

  it('refreshes the guide-coverage anchor but not its audit lines', () => {
    let doc = 'docs/guide-skill-coverage.md'
    let root = fixture({
      [doc]: [
        '**Anchor:** installed `remix 3.2.0` at preview release `' +
          OLD_TAG +
          '` (source `aaaaaaaa`; all 15 guides byte-identical to `a5cc1ea2`).',
        '**2026-11-15 re-audit.** Re-checked against `' +
          OLD_TAG +
          '` / source `aaaaaaaa`; the pinned build is history here.',
      ].join('\n'),
    })

    let result = refreshPinDocs(root, change)

    assert.deepEqual(result.updated, [doc])
    assert.deepEqual(result.skipped, [])
    let text = fs.readFileSync(path.join(root, doc), 'utf8')
    assert.ok(
      text.startsWith(
        '**Anchor:** installed `remix 3.2.0` at preview release `' +
          NEW_TAG +
          '` (source `bbbbbbbb`',
      ),
      'anchor refreshed',
    )
    assert.ok(
      text.includes('Re-checked against `' + OLD_TAG + '` / source `aaaaaaaa`'),
      'audit line kept',
    )
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

const ROOT = path.resolve(import.meta.dirname, '..')

const expectation: AnalysisExpectation = {
  tag: 'v0.0.20260102-main-bbbbbbbb',
  source: 'bbbbbbbb',
  versions: {
    remix: '3.3.0',
    '@remix-run/ui': '0.14.0',
    '@remix-run/component': '1.3.0',
    'component-hmr': '1.0.2',
  },
  releaseRefs: 277,
}

function analysisDoc(
  overrides: {
    tag?: string
    source?: string
    remix?: string
    pinTo?: string
    releaseRefs?: number
    summaryCommits?: number
  } = {},
): string {
  let tag = overrides.tag ?? expectation.tag
  let source = overrides.source ?? expectation.source
  let remix = overrides.remix ?? expectation.versions.remix
  let pinTo = overrides.pinTo ?? expectation.source
  let releaseRefs = overrides.releaseRefs ?? expectation.releaseRefs
  let summaryCommits = overrides.summaryCommits ?? 5

  return [
    'Current install: `remix` ' +
      remix +
      ' / `@remix-run/ui` ' +
      expectation.versions['@remix-run/ui'] +
      ' / `@remix-run/component` ' +
      expectation.versions['@remix-run/component'] +
      ' / `component-hmr` ' +
      expectation.versions['component-hmr'] +
      ' at preview release `' +
      tag +
      '` (source `' +
      source +
      '`). The two `package.json` specs are the release asset URLs; the lock has ' +
      releaseRefs +
      ' release tarball refs at that tag.',
    '',
    'Current pin: `aaaaaaaa` → `' + pinTo + '` (5 commits).',
    '',
    'Current range summary: ' + summaryCommits + ' commits. hand-authored prose.',
  ].join('\n')
}

describe('analysis doc drift', () => {
  it('accepts a summary that matches the pin', () => {
    assert.deepEqual(compareAnalysisDoc(analysisDoc(), expectation), [])
  })

  it('reports a stale version, source, and pin endpoint', () => {
    let issues = compareAnalysisDoc(
      analysisDoc({ remix: '3.2.0', source: 'aaaaaaaa', pinTo: '9e4da4d3' }),
      expectation,
    )

    assert.ok(
      issues.some((issue) => issue.includes('remix 3.2.0')),
      'stale remix version reported',
    )
    assert.ok(
      issues.some((issue) => issue.includes('source is aaaaaaaa')),
      'stale source reported',
    )
    assert.ok(
      issues.some((issue) => issue.includes('ends at 9e4da4d3')),
      'stale pin endpoint reported',
    )
  })

  it('checks only the range summary commit count, not its prose', () => {
    let doc = analysisDoc().replace(
      'Current range summary: 5 commits. hand-authored prose.',
      'Current range summary: 5 commits. Different prose is still valid.',
    )

    assert.deepEqual(compareAnalysisDoc(doc, expectation), [])
  })

  it('reports a stale lock-ref count and summary commit count', () => {
    let issues = compareAnalysisDoc(
      analysisDoc({ releaseRefs: 278, summaryCommits: 6 }),
      expectation,
    )

    assert.ok(
      issues.some((issue) => issue.includes('says 278 release tarball refs')),
      'stale lock-ref count reported',
    )
    assert.ok(
      issues.some(
        (issue) => issue.includes('says 6 commits') && issue.includes('"Current pin" says 5'),
      ),
      'stale summary count reported',
    )
  })

  it('flags a summary without a current-install or current-pin line', () => {
    let issues = compareAnalysisDoc('no pin summary here', expectation)

    assert.ok(
      issues.some((issue) => issue.includes('no "Current install:"')),
      'missing install line reported',
    )
    assert.ok(
      issues.some((issue) => issue.includes('no "Current pin')),
      'missing pin line reported',
    )
  })

  it('keeps the real analysis reference on the current install', () => {
    assert.deepEqual(checkAnalysisDoc(ROOT), [])
  })
})

function agentsDoc(
  overrides: { releaseRefs?: number; bumpTo?: string; bumpCommits?: number } = {},
): string {
  return [
    'The pin is release `' +
      expectation.tag +
      '` (source `' +
      expectation.source +
      '`), so the two asset URLs and the ' +
      (overrides.releaseRefs ?? expectation.releaseRefs) +
      '-ref unified lock are the pin.',
    '- **Current bump (`aaaaaaaa` → `' +
      (overrides.bumpTo ?? expectation.source) +
      '`):** ' +
      (overrides.bumpCommits ?? 1) +
      ' commit. #1 example change.',
  ].join('\n')
}

describe('AGENTS.md pin drift', () => {
  it('accepts the current bump endpoint and lock-ref count', () => {
    let root = fixture({ 'AGENTS.md': agentsDoc() })
    assert.deepEqual(checkAgentsDoc(root, expectation), [])
  })

  it('reports a stale bump endpoint and lock-ref count', () => {
    let root = fixture({ 'AGENTS.md': agentsDoc({ bumpTo: 'aaaaaaaa', releaseRefs: 278 }) })
    let issues = checkAgentsDoc(root, expectation)

    assert.ok(
      issues.some(
        (issue) => issue.includes('says 278') && issue.includes('has 277 release tarball refs'),
      ),
      'stale AGENTS lock-ref count reported',
    )
    assert.ok(
      issues.some(
        (issue) => issue.includes('ends at aaaaaaaa') && issue.includes('expected bbbbbbbb'),
      ),
      'stale AGENTS current bump reported',
    )
  })

  it('reports a stale AGENTS current-bump commit count', () => {
    let analysis =
      '.opencode/skills/learned/remix3/references/remix3-build-and-tooling/upstream-dependency-analysis.md'
    let root = fixture({
      'AGENTS.md': agentsDoc({ bumpCommits: 2 }),
      [analysis]: analysisDoc(),
    })

    assert.ok(
      checkAgentsDoc(root, expectation).some(
        (issue) => issue.includes('says 2 commits') && issue.includes('"Current pin" says 5'),
      ),
      'stale AGENTS bump count reported',
    )
  })

  it('keeps the real AGENTS current bump on the current install', () => {
    assert.deepEqual(checkAgentsDoc(ROOT, readAnalysisExpectation(ROOT)), [])
  })
})
