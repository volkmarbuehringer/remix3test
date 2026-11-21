// ---------------------------------------------------------------------------
// Pin-history writer.
//
// A successful `update:remix` writes the mechanical part of the dated entry
// (lock, versions, verification) and a newest-first table row; the editorial
// bullets stay TODO for the operator to fill. Aborted runs print the same
// scaffold instead of writing it.
// ---------------------------------------------------------------------------

export const PIN_HISTORY_FILE = 'docs/remix-pin-history.md'

const MARKER = '**Pin history (newest first).**'

export type PinHistoryEntry = {
  date: string
  oldTag: string
  oldSource: string
  targetTag: string
  targetSource: string
  subjects: string[] | undefined
  refs: number
  versions: string
  tests: string
}

function source8(source: string): string {
  return /^[0-9a-f]{8,}$/i.test(source) ? source.slice(0, 8) : source
}

export function formatPinHistoryEntry(args: PinHistoryEntry): string {
  let commits = args.subjects?.length
    ? ' (' + args.subjects.length + ' commits: ' + args.subjects.join('; ') + ')'
    : ''

  return (
    [
      `**Bump recorded ${args.date}: preview release \`${args.oldTag}\`/source \`${source8(args.oldSource)}\` → \`${args.targetTag}\`/source \`${source8(args.targetSource)}\`${commits}.**`,
      '',
      `- **Lock:** all ${args.refs} release-tarball refs resolve to \`${args.targetTag}\`; no refs to the old tag remain.`,
      `- **Versions:** ${args.versions}.`,
      '- **Package delta:** TODO — diff the old and new installed trees before recording.',
      '- **Breaking:** TODO — review the Major/Minor/Patch changelog entries printed above; a minor/patch can still change consumer behavior (e.g. data-table 1.1.0 sql arrays).',
      '- **Behavior:** TODO — one bullet per runtime/API change.',
      '- **App-side clearance:** TODO — call sites, or "no production source change".',
      `- **Verification (${args.date}):** ${args.tests}.`,
    ].join('\n') + '\n'
  )
}

export function buildPinHistoryRow(args: PinHistoryEntry): string {
  let highlights = (args.subjects?.length ? args.subjects.join('; ') : 'pin bump').replaceAll(
    '|',
    '\\|',
  )
  return `| ${args.date} | \`${args.targetTag}\` | \`${source8(args.targetSource)}\` | ${highlights} |`
}

export function hasPinHistoryEntry(doc: string, targetTag: string): boolean {
  return doc.includes(`→ \`${targetTag}\`/source`)
}

export function insertPinHistoryEntry(doc: string, entry: string): string {
  let marker = doc.indexOf(MARKER)
  let next = entry.trim()
  if (marker === -1) {
    return doc.replace(/\n+$/, '') + '\n\n' + next + '\n'
  }

  let before = doc.slice(0, marker).replace(/\n+$/, '')
  return before + '\n\n' + next + '\n\n' + doc.slice(marker)
}

export function insertPinHistoryRow(doc: string, row: string): string {
  let lines = doc.split('\n')
  let header = lines.findIndex((line) => line.startsWith('| Recorded'))
  if (header === -1 || !lines[header + 1]?.includes('---')) return doc

  lines.splice(header + 2, 0, row)
  return lines.join('\n')
}
