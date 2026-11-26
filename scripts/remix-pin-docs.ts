import * as fs from 'node:fs'
import * as path from 'node:path'

type PinChange = {
  oldTag: string
  oldSource: string
  newTag: string
  newSource: string
  /** Commits between the old and new source, for the mechanical analysis line. */
  commits: number | undefined
}

type PinDocsResult = {
  /** Files whose current-pin strings were rewritten, relative to the root. */
  updated: string[]
  /** Historical or ambiguous lines left untouched, as `file:line` (or a note). */
  skipped: string[]
}

const LEARNED_DIR = path.join('.opencode', 'skills', 'learned')
const AGENTS_FILE = 'AGENTS.md'
// Docs whose "**Anchor:**" line names the current install. Only that line is
// refreshed; the audit entries around it are history and must not be rewritten.
const DOC_ANCHOR_FILES = [path.join('docs', 'guide-skill-coverage.md')]
const DOC_ANCHOR_MARKER = '**Anchor:**'

// Lines such as "Since preview build `3273a048` (#12153)",
// "Since #12183 (pin `848e2fbe`)", "since #12290 (preview `5af14d52`)",
// "Since the `b4a0aa9a` pin …", or "on a pin older than `5af14d52`" describe
// when a behavior landed; bumping the pin must not rewrite that history. The
// same applies to "Revalidated: … against preview release `…`" headers: they
// record when a skill was last checked, so a later bump is not a revalidation.
// "Current range summary:" is hand-authored prose and is left alone; the
// separate "Current pin:" line below it is the mechanical endpoint.
const HISTORICAL_LINE = /\b(?:Since|Re-?validated|Validated|Current range)\b|\bolder\s+than\b/i
const PIN_LINE = /Current pin: `([0-9a-f]{8})` → `([0-9a-f]{8})` \((\d+) commits?\)/

function source8(source: string): string {
  return /^[0-9a-f]{8,}$/i.test(source) ? source.slice(0, 8) : source
}

function walkMarkdown(dir: string): string[] {
  let files: string[] = []
  for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
    let full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkMarkdown(full))
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full)
  }
  return files
}

function replacePins(
  line: string,
  change: PinChange,
  oldSource: string,
  newSource: string,
): string {
  let next = change.oldTag ? line.split(change.oldTag).join(change.newTag) : line
  // Sources are 8- or 40-hex; anything else (a tag used as a fallback when the
  // GitHub lookup failed) must not be interpolated into a RegExp.
  if (oldSource && /^[0-9a-f]{8,}$/i.test(oldSource)) {
    next = next.replace(new RegExp(`\\b${oldSource}\\b`, 'g'), newSource)
  }
  return next
}

/**
 * Rewrites the mechanical "current pin" strings in the learned skills, the
 * AGENTS.md pin sentence, and the guide-coverage anchor. Historical statements
 * ("Since preview build …") and the editorial bump summaries are left alone;
 * the caller prints those TODOs.
 *
 * `dryRun` reports what would change without writing anything.
 */
export function refreshPinDocs(
  root: string,
  change: PinChange,
  options: { dryRun?: boolean } = {},
): PinDocsResult {
  let oldSource = source8(change.oldSource)
  let newSource = source8(change.newSource)
  let updated: string[] = []
  let skipped: string[] = []

  let learnedRoot = path.join(root, LEARNED_DIR)
  let learnedFiles = fs.existsSync(learnedRoot) ? walkMarkdown(learnedRoot) : []
  let docAnchorFiles = DOC_ANCHOR_FILES.map((file) => path.join(root, file)).filter((file) =>
    fs.existsSync(file),
  )
  let docAnchorSet = new Set(docAnchorFiles)
  let files = [...learnedFiles, ...docAnchorFiles]

  for (let file of files) {
    let before = fs.readFileSync(file, 'utf8')
    let lines = before.split('\n')
    let changed = false

    for (let index = 0; index < lines.length; index++) {
      let line = lines[index] ?? ''
      // A doc's audit entries are history; only its Anchor line is current.
      if (docAnchorSet.has(file) && !line.startsWith(DOC_ANCHOR_MARKER)) continue

      // The analysis reference keeps its mechanical endpoint on a line of its
      // own, so the editorial summary below it is never rewritten.
      let pin = PIN_LINE.exec(line)
      if (pin && /^[0-9a-f]{8}$/i.test(oldSource) && /^[0-9a-f]{8}$/i.test(newSource)) {
        let count = change.commits ?? Number(pin[3])
        let next =
          `Current pin: \`${oldSource}\` → \`${newSource}\` ` +
          `(${count} commit${count === 1 ? '' : 's'}).`
        if (next !== line) {
          lines[index] = next
          changed = true
        }
        continue
      }

      let mentionsOldPin =
        (change.oldTag.length > 0 && line.includes(change.oldTag)) ||
        (oldSource.length > 0 && line.includes(oldSource))
      if (!mentionsOldPin) continue
      if (HISTORICAL_LINE.test(line)) {
        skipped.push(`${path.relative(root, file)}:${index + 1}`)
        continue
      }

      let next = replacePins(line, change, oldSource, newSource)
      if (next !== line) {
        lines[index] = next
        changed = true
      }
    }

    if (changed) {
      updated.push(path.relative(root, file))
      if (!options.dryRun) fs.writeFileSync(file, lines.join('\n'))
    }
  }

  let agentsPath = path.join(root, AGENTS_FILE)
  if (fs.existsSync(agentsPath)) {
    let before = fs.readFileSync(agentsPath, 'utf8')
    let phrase = `release \`${change.oldTag}\` (source \`${oldSource}\`)`
    let replacement = `release \`${change.newTag}\` (source \`${newSource}\`)`
    if (before.includes(phrase)) {
      updated.push(AGENTS_FILE)
      if (!options.dryRun) fs.writeFileSync(agentsPath, before.replace(phrase, replacement))
    } else {
      skipped.push(`${AGENTS_FILE}: pin sentence not found`)
    }
  }

  return { updated, skipped }
}

// ---------------------------------------------------------------------------
// Current-install drift check
//
// `refreshPinDocs` refreshes the analysis reference's tag/source and the
// mechanical "Current pin" line, but not its version numbers or the editorial
// "Current range summary". Compare those claims with package.json and
// pnpm-lock.yaml so `remix:pin:check` and the test suite fail loudly instead.

const ANALYSIS_DOC = path.join(
  '.opencode',
  'skills',
  'learned',
  'remix3',
  'references',
  'remix3-build-and-tooling',
  'upstream-dependency-analysis.md',
)

const ANALYSIS_PACKAGES = [
  { label: 'remix', name: 'remix', asset: 'remix' },
  { label: '@remix-run/ui', name: '@remix-run/ui', asset: 'ui' },
  { label: '@remix-run/component', name: '@remix-run/component', asset: 'component' },
  { label: 'component-hmr', name: '@remix-run/component-hmr', asset: 'component-hmr' },
] as const

type AnalysisLabel = (typeof ANALYSIS_PACKAGES)[number]['label']

export type AnalysisExpectation = {
  tag: string
  source: string
  versions: Record<AnalysisLabel, string>
}

type AnalysisClaim = {
  tag: string | undefined
  source: string | undefined
  versions: Record<AnalysisLabel, string | undefined>
  pinFrom: string | undefined
  pinTo: string | undefined
  pinCommits: string | undefined
}

const INSTALL_LINE =
  /Current install: `remix` (\S+) \/ `@remix-run\/ui` (\S+) \/ `@remix-run\/component` (\S+) \/ `component-hmr` (\S+) at preview release `([^`]+)` \(source `([0-9a-f]{8})`\)/

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function lockVersion(lock: string, name: string, asset: string): string | undefined {
  // Tarball dependencies key the lock entry by their URL, not by a semver; the
  // installed version is the `version:` field that follows the resolution.
  let pattern = new RegExp(
    `^  '?${escapeRegExp(name)}@https://[^'\\n]*\\/${escapeRegExp(asset)}\\.tgz'?:\\n` +
      '    resolution: \\{[^\\n]*\\}\\n' +
      '    version: ([^\\n]+)$',
    'm',
  )
  return pattern.exec(lock)?.[1]
}

export function readAnalysisExpectation(root: string): AnalysisExpectation {
  let manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
  }
  let spec = manifest.dependencies?.remix ?? ''
  let tag = /releases\/download\/([^/]+)\/remix\.tgz/.exec(spec)?.[1]
  if (!tag) throw new Error(`package.json remix spec is not a preview release asset: ${spec}`)
  let source = /-main-([0-9a-f]{8})/.exec(tag)?.[1]
  if (!source) throw new Error(`cannot read the source commit from the remix pin tag: ${tag}`)

  let lock = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8')
  let versions = {} as Record<AnalysisLabel, string>
  for (let entry of ANALYSIS_PACKAGES) {
    let version = lockVersion(lock, entry.name, entry.asset)
    if (!version) {
      throw new Error(`pnpm-lock.yaml has no ${entry.name} entry at the pinned release`)
    }
    versions[entry.label] = version
  }

  return { tag, source, versions }
}

export function analyzeAnalysisDoc(doc: string): AnalysisClaim {
  let claim: AnalysisClaim = {
    tag: undefined,
    source: undefined,
    versions: {
      remix: undefined,
      '@remix-run/ui': undefined,
      '@remix-run/component': undefined,
      'component-hmr': undefined,
    },
    pinFrom: undefined,
    pinTo: undefined,
    pinCommits: undefined,
  }

  let install = INSTALL_LINE.exec(doc)
  if (install) {
    claim.versions.remix = install[1]
    claim.versions['@remix-run/ui'] = install[2]
    claim.versions['@remix-run/component'] = install[3]
    claim.versions['component-hmr'] = install[4]
    claim.tag = install[5]
    claim.source = install[6]
  }
  let pin = PIN_LINE.exec(doc)
  if (pin) {
    claim.pinFrom = pin[1]
    claim.pinTo = pin[2]
    claim.pinCommits = pin[3]
  }
  return claim
}

export function compareAnalysisDoc(doc: string, expected: AnalysisExpectation): string[] {
  let claim = analyzeAnalysisDoc(doc)
  let issues: string[] = []

  if (!claim.tag) {
    issues.push('no "Current install:" line with the preview release tag and source')
  } else {
    if (claim.tag !== expected.tag) {
      issues.push(`"Current install" names ${claim.tag}; expected ${expected.tag}`)
    }
    if (claim.source !== expected.source) {
      issues.push(`"Current install" source is ${claim.source}; expected ${expected.source}`)
    }
  }

  for (let { label } of ANALYSIS_PACKAGES) {
    let actual = claim.versions[label]
    let wanted = expected.versions[label]
    if (actual !== wanted) {
      issues.push(
        `"Current install" says ${label} ${actual ?? '(missing)'}; installed version is ${wanted}`,
      )
    }
  }

  if (!claim.pinTo) {
    issues.push('no "Current pin (`old` → `new`, N commits)" line')
  } else if (claim.pinTo !== expected.source) {
    issues.push(
      `"Current pin" ends at ${claim.pinTo}; expected ${expected.source} (the pinned source)`,
    )
  }

  return issues
}

export function checkAnalysisDoc(root: string): string[] {
  let docPath = path.join(root, ANALYSIS_DOC)
  if (!fs.existsSync(docPath)) {
    return [`the analysis reference is missing: ${ANALYSIS_DOC}`]
  }

  let expected: AnalysisExpectation
  try {
    expected = readAnalysisExpectation(root)
  } catch (error) {
    return [
      `cannot derive the installed versions: ${error instanceof Error ? error.message : String(error)}`,
    ]
  }

  return compareAnalysisDoc(fs.readFileSync(docPath, 'utf8'), expected)
}
