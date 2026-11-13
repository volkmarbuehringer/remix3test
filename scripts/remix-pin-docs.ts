import * as fs from 'node:fs'
import * as path from 'node:path'

type PinChange = {
  oldTag: string
  oldSource: string
  newTag: string
  newSource: string
}

type PinDocsResult = {
  /** Files whose current-pin strings were rewritten, relative to the root. */
  updated: string[]
  /** Historical or ambiguous lines left untouched, as `file:line` (or a note). */
  skipped: string[]
}

const LEARNED_DIR = path.join('.opencode', 'skills', 'learned')
const AGENTS_FILE = 'AGENTS.md'

// Lines such as "Since preview build `3273a048` (#12153)" or
// "Since remix #12203 (pin `0cab1903`)" describe when a behavior landed;
// bumping the pin must not rewrite that history. The same applies to
// "Revalidated: … against preview release `…`" headers: they record when a
// skill was last checked, so a later bump is not a revalidation.
const HISTORICAL_LINE =
  /\b(?:Since\s+(?:(?:preview\s+)?(?:build|release)|remix\s+#\d+)|Revalidated)\b/i

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
 * Rewrites the mechanical "current pin" strings in the learned skills and the
 * AGENTS.md pin sentence. Historical statements ("Since preview build …") and
 * the editorial bump summaries are left alone; the caller prints those TODOs.
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
  let files = fs.existsSync(learnedRoot) ? walkMarkdown(learnedRoot) : []
  for (let file of files) {
    let before = fs.readFileSync(file, 'utf8')
    let lines = before.split('\n')
    let changed = false

    for (let index = 0; index < lines.length; index++) {
      let line = lines[index] ?? ''
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
